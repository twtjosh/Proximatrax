import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBoardStage, validateStageTransition, type BoardColumnStage, type WorkflowGateContext, } from "@/lib/board-workflow";
import { toGateTasks } from "@/lib/milestone-task-gates";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/services/activity-service";
import { assertProjectNotArchived, listMilestones, syncMilestoneFromLinkedTasks, } from "@/services/project-service";
import { indexAttachmentsByTask, listApprovedAttachmentsForProject, approveTaskAttachmentsForClient, } from "@/services/task-attachment-service";
import { listAssignedTasksForUser, listClientVisibleDeliverables, listTasksForProject, updateTask, type TaskWithProject, type TaskWithRelations, } from "@/services/task-service";
import { dismissWorkNotificationsForTask, notifyWorkReadyAfterProjectTaskChange, snapshotProjectTasksForNotify, } from "@/services/work-notification-service";
import type { TaskAttachment } from "@/types/database";
import type { TaskStage, UserRole } from "@/types/enums";
export { listAssignedTasksForUser, listApprovedAttachmentsForProject, listClientVisibleDeliverables, indexAttachmentsByTask, };
export type { TaskWithProject, TaskWithRelations };
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
async function buildWorkflowGateContext(projectId: string, client?: SupabaseClient): Promise<WorkflowGateContext> {
    const sb = resolveClient(client);
    const [milestones, tasks] = await Promise.all([
        listMilestones(projectId, sb),
        listTasksForProject(projectId, sb),
    ]);
    return {
        milestones,
        tasks: toGateTasks(tasks),
    };
}
export function taskNeedsSitePhoto(attachments: TaskAttachment[], minPhotos = 1): boolean {
    const photos = attachments.filter((a) => a.media_kind === "photo").length;
    return photos >= minPhotos;
}
export async function moveTaskToStage(task: TaskWithRelations, targetStage: BoardColumnStage, viewerRole: UserRole, viewerId: string, projectId: string, options?: {
    claimAssigneeId?: string;
    skipPhotoCheck?: boolean;
}): Promise<void> {
    const sourceStage = normalizeBoardStage(task.stage);
    if (sourceStage === targetStage)
        return;
    const sb = resolveClient();
    await assertProjectNotArchived(projectId, sb);
    const tasksBefore = await snapshotProjectTasksForNotify(projectId, sb);
    const gateContext = await buildWorkflowGateContext(projectId, sb);
    const validation = validateStageTransition(task, sourceStage, targetStage, viewerRole, gateContext);
    if (!validation.ok) {
        throw new Error(validation.failures[0]?.message ?? "Move not allowed.");
    }
    const claimAssigneeId = options?.claimAssigneeId ??
        (validation.claimAssignee === "self" ? viewerId : undefined);
    if (sourceStage === "in_progress" &&
        targetStage === "review" &&
        !options?.skipPhotoCheck) {
        const sb = resolveClient();
        const { data } = await sb
            .from("task_attachments")
            .select("*")
            .eq("task_id", task.id);
        const attachments = (data ?? []) as TaskAttachment[];
        if (!taskNeedsSitePhoto(attachments)) {
            throw new Error("Upload at least one site photo before submitting for review.");
        }
    }
    await updateTask({
        id: task.id,
        stage: targetStage as TaskStage,
        ...(claimAssigneeId ? { assigned_to: claimAssigneeId } : {}),
    });
    await logActivity({
        project_id: projectId,
        action_type: "task_moved",
        details: {
            task_id: task.id,
            title: task.title,
            from: sourceStage,
            to: targetStage,
            handoff: true,
        },
    });
    await syncMilestoneFromLinkedTasks(projectId, task.milestone_id, sb);
    await notifyWorkReadyAfterProjectTaskChange(projectId, tasksBefore, sb);
    if (targetStage === "done") {
        await dismissWorkNotificationsForTask(task.id, sb);
    }
}
export async function acceptTaskDeliverable(task: TaskWithRelations, projectId: string, client?: SupabaseClient): Promise<{
    milestoneCompleted?: string;
}> {
    const sb = resolveClient(client);
    await assertProjectNotArchived(projectId, sb);
    const tasksBefore = await snapshotProjectTasksForNotify(projectId, sb);
    const now = new Date().toISOString();
    await updateTask({
        id: task.id,
        stage: "done",
        client_visible_at: now,
    }, sb);
    await approveTaskAttachmentsForClient(task.id, now, sb);
    await logActivity({
        project_id: projectId,
        action_type: "task_moved",
        details: {
            task_id: task.id,
            title: task.title,
            from: "review",
            to: "done",
            handoff: true,
            client_visible: true,
        },
    }, sb);
    const sync = await syncMilestoneFromLinkedTasks(projectId, task.milestone_id, sb);
    await dismissWorkNotificationsForTask(task.id, sb);
    await notifyWorkReadyAfterProjectTaskChange(projectId, tasksBefore, sb);
    return sync.completed && sync.title ? { milestoneCompleted: sync.title } : {};
}
export async function sendTaskBackToActive(task: TaskWithRelations, projectId: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    await assertProjectNotArchived(projectId, sb);
    const tasksBefore = await snapshotProjectTasksForNotify(projectId, sb);
    await updateTask({ id: task.id, stage: "in_progress" }, sb);
    await logActivity({
        project_id: projectId,
        action_type: "task_moved",
        details: {
            task_id: task.id,
            title: task.title,
            from: "review",
            to: "in_progress",
            handoff: true,
        },
    }, sb);
    await syncMilestoneFromLinkedTasks(projectId, task.milestone_id, sb);
    await notifyWorkReadyAfterProjectTaskChange(projectId, tasksBefore, sb);
}
export function sortWorkTodayTasks(tasks: TaskWithProject[]): TaskWithProject[] {
    const rank = (stage: TaskStage) => {
        if (stage === "in_progress")
            return 0;
        if (stage === "review")
            return 1;
        if (stage === "to_do" || stage === "backlog")
            return 2;
        return 3;
    };
    return [...tasks].sort((a, b) => {
        const stageDiff = rank(a.stage) - rank(b.stage);
        if (stageDiff !== 0)
            return stageDiff;
        if (a.due_date && b.due_date)
            return a.due_date.localeCompare(b.due_date);
        if (a.due_date)
            return -1;
        if (b.due_date)
            return 1;
        return a.title.localeCompare(b.title);
    });
}
export async function refreshProjectWorkData(projectId: string) {
    const [tasks, attachments] = await Promise.all([
        listTasksForProject(projectId),
        listApprovedAttachmentsForProject(projectId),
    ]);
    return { tasks, attachments };
}
