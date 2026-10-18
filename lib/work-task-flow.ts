import type { SupabaseClient } from "@supabase/supabase-js";
import { normalizeBoardStage, parseChecklist, validateStageTransition, type BoardColumnStage, type WorkflowGateContext, } from "@/lib/board-workflow";
import { hasSiteEvidence } from "@/lib/media-kind";
import { toGateTasks } from "@/lib/milestone-task-gates";
import { toTaskNotifySnapshots, type TaskNotifySnapshot } from "@/lib/work-ready-notifications";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { logActivity } from "@/services/activity-service";
import { listMilestones, syncMilestoneFromLinkedTasks, } from "@/services/project-service";
import { sendBackChecklist } from "@/lib/review-queue";
import { indexAttachmentsByTask, listApprovedAttachmentsForProject, approveAttachmentsForClient, approveTaskAttachmentsForClient, } from "@/services/task-attachment-service";
import { listAssignedTasksForUser, listClientVisibleDeliverables, listTasksForProject, updateTask, type TaskWithProject, type TaskWithRelations, } from "@/services/task-service";
import { dismissWorkNotificationsForTask, notifyWorkReadyAfterProjectTaskChange, snapshotProjectTasksForNotify, } from "@/services/work-notification-service";
import type { TaskAttachment } from "@/types/database";
import type { TaskStage, UserRole } from "@/types/enums";
export { listAssignedTasksForUser, listApprovedAttachmentsForProject, listClientVisibleDeliverables, indexAttachmentsByTask, };
export type { TaskWithProject, TaskWithRelations };
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
/** After a task's stage changes: its phase may complete or reopen, and that can make someone's next work ready. */
async function settleProject(projectId: string, milestoneId: string | null | undefined, tasksBefore: TaskNotifySnapshot[], sb: SupabaseClient) {
    const sync = await syncMilestoneFromLinkedTasks(projectId, milestoneId, sb);
    await notifyWorkReadyAfterProjectTaskChange(projectId, tasksBefore, sb);
    return sync;
}
/** Submitting needs proof of the work: at least one site photo or video. */
export function taskNeedsSitePhoto(attachments: TaskAttachment[]): boolean {
    return hasSiteEvidence(attachments);
}
export async function moveTaskToStage(task: TaskWithRelations, targetStage: BoardColumnStage, viewerRole: UserRole, viewerId: string, projectId: string, options?: {
    claimAssigneeId?: string;
    skipPhotoCheck?: boolean;
}): Promise<void> {
    const sourceStage = normalizeBoardStage(task.stage);
    if (sourceStage === targetStage)
        return;
    const sb = resolveClient();
    const checkPhoto = sourceStage === "in_progress" && targetStage === "review" && !options?.skipPhotoCheck;
    // Everything the move is checked against, in one round trip. One task read serves both the gates and the before-snapshot.
    const [milestones, projectTasks, attachments] = await Promise.all([
        listMilestones(projectId, sb),
        listTasksForProject(projectId, sb),
        checkPhoto ? sb.from("task_attachments").select("*").eq("task_id", task.id).then((r) => (r.data ?? []) as TaskAttachment[]) : null,
    ]);
    const gateContext: WorkflowGateContext = { milestones, tasks: toGateTasks(projectTasks) };
    const validation = validateStageTransition(task, sourceStage, targetStage, viewerRole, gateContext);
    if (!validation.ok) {
        throw new Error(validation.failures[0]?.message ?? "Move not allowed.");
    }
    const claimAssigneeId = options?.claimAssigneeId ??
        (validation.claimAssignee === "self" ? viewerId : undefined);
    if (attachments && !taskNeedsSitePhoto(attachments)) {
        throw new Error("Upload at least one site photo or video before submitting for review.");
    }
    const tasksBefore = toTaskNotifySnapshots(projectTasks);
    // Refuses a closed project before writing anything.
    await updateTask({
        id: task.id,
        stage: targetStage as TaskStage,
        ...(claimAssigneeId ? { assigned_to: claimAssigneeId } : {}),
    }, sb);
    // The move is done; the log, the phase and the notifications don't depend on one another.
    await Promise.all([
        logActivity({
            project_id: projectId,
            action_type: "task_moved",
            details: {
                task_id: task.id,
                title: task.title,
                from: sourceStage,
                to: targetStage,
                handoff: true,
            },
        }, sb),
        settleProject(projectId, task.milestone_id, tasksBefore, sb),
        targetStage === "done" ? dismissWorkNotificationsForTask(task.id, sb) : null,
    ]);
}
/**
 * The PM accepts work: it becomes visible to the client with the photos the
 * PM chose (`photoIds`), or with all of the task's photos when none are given.
 */
export async function acceptTaskDeliverable(task: TaskWithRelations, projectId: string, client?: SupabaseClient, options?: {
    photoIds?: string[];
}): Promise<{
    milestoneCompleted?: string;
}> {
    const sb = resolveClient(client);
    const tasksBefore = await snapshotProjectTasksForNotify(projectId, sb);
    const now = new Date().toISOString();
    // Refuses a closed project before writing anything.
    await updateTask({
        id: task.id,
        stage: "done",
        client_visible_at: now,
    }, sb);
    const [, , sync] = await Promise.all([
        options?.photoIds ? approveAttachmentsForClient(options.photoIds, now, sb) : approveTaskAttachmentsForClient(task.id, now, sb),
        logActivity({
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
        }, sb),
        settleProject(projectId, task.milestone_id, tasksBefore, sb),
        dismissWorkNotificationsForTask(task.id, sb),
    ]);
    return sync.completed && sync.title ? { milestoneCompleted: sync.title } : {};
}
/**
 * The PM returns work to the crew. A reason goes to the top of the task's
 * checklist as an unticked "Fix: …" item and into the activity log.
 */
export async function sendTaskBackToActive(task: TaskWithRelations, projectId: string, client?: SupabaseClient, reason?: string): Promise<void> {
    const sb = resolveClient(client);
    const tasksBefore = await snapshotProjectTasksForNotify(projectId, sb);
    const note = reason?.trim();
    // Refuses a closed project before writing anything.
    await updateTask({
        id: task.id,
        stage: "in_progress",
        ...(note ? { checklist: sendBackChecklist(parseChecklist(task.checklist), note, crypto.randomUUID()) } : {}),
    }, sb);
    await Promise.all([
        logActivity({
            project_id: projectId,
            action_type: "task_moved",
            details: {
                task_id: task.id,
                title: task.title,
                from: "review",
                to: "in_progress",
                handoff: true,
                ...(note ? { reason: note } : {}),
            },
        }, sb),
        settleProject(projectId, task.milestone_id, tasksBefore, sb),
    ]);
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