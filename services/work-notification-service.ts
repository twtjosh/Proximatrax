import type { SupabaseClient } from "@supabase/supabase-js";
import { projectPath } from "@/lib/constants";
import { findNewlyReadyAssignedTasks, toTaskNotifySnapshots, workReadyNotificationCopy, type TaskNotifySnapshot, } from "@/lib/work-ready-notifications";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { throwIfSupabaseError } from "@/lib/utils";
import { listMilestones } from "@/services/project-service";
import { listTasksForProject } from "@/services/task-service";
import type { UserNotification } from "@/types/database";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export async function listWorkNotifications(userId: string, client?: SupabaseClient, limit = 20): Promise<UserNotification[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("user_notifications")
        .select("*")
        .eq("user_id", userId)
        .order("created_at", { ascending: false })
        .limit(limit);
    throwIfSupabaseError(error);
    return (data ?? []) as UserNotification[];
}
export async function countUnreadWorkNotifications(userId: string, client?: SupabaseClient): Promise<number> {
    const sb = resolveClient(client);
    const { count, error } = await sb
        .from("user_notifications")
        .select("id", { count: "exact", head: true })
        .eq("user_id", userId)
        .is("read_at", null);
    throwIfSupabaseError(error);
    return count ?? 0;
}
export async function markWorkNotificationRead(notificationId: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("id", notificationId);
    throwIfSupabaseError(error);
}
export async function markAllWorkNotificationsRead(userId: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("user_id", userId)
        .is("read_at", null);
    throwIfSupabaseError(error);
}
async function createWorkReadyNotification(userId: string, taskId: string, projectId: string, title: string, body: string, href: string, client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc("create_work_ready_notification", {
        p_user_id: userId,
        p_task_id: taskId,
        p_project_id: projectId,
        p_title: title,
        p_body: body,
        p_href: href,
    });
    throwIfSupabaseError(error);
}
export async function dismissWorkNotificationsForTask(taskId: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb
        .from("user_notifications")
        .update({ read_at: new Date().toISOString() })
        .eq("task_id", taskId)
        .eq("kind", "task_ready")
        .is("read_at", null);
    throwIfSupabaseError(error);
}
export type MilestoneDeliveredNotifyInput = {
    projectId: string;
    milestoneId: string;
    milestoneTitle: string;
    source: "auto" | "manual";
};
function milestoneDeliveredNotificationCopy(input: MilestoneDeliveredNotifyInput, projectTitle?: string | null): {
    title: string;
    body: string;
    href: string;
} {
    const phase = input.milestoneTitle.trim() || "Project phase";
    const projectLabel = projectTitle?.trim() ? ` for ${projectTitle.trim()}` : "";
    if (input.source === "auto") {
        return {
            title: "Phase delivered",
            body: `All work for "${phase}" is complete${projectLabel}. Review the latest progress in your project.`,
            href: projectPath(input.projectId),
        };
    }
    return {
        title: "Phase delivered",
        body: `"${phase}" has been marked complete${projectLabel}.`,
        href: projectPath(input.projectId),
    };
}
async function createMilestoneDeliveredNotification(userId: string, input: MilestoneDeliveredNotifyInput, title: string, body: string, href: string, client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc("create_milestone_delivered_notification", {
        p_user_id: userId,
        p_milestone_id: input.milestoneId,
        p_project_id: input.projectId,
        p_title: title,
        p_body: body,
        p_href: href,
    });
    throwIfSupabaseError(error);
}
export async function notifyClientMilestoneDelivered(input: MilestoneDeliveredNotifyInput, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { data: project, error: projectError } = await sb
        .from("projects")
        .select("client_id, title")
        .eq("id", input.projectId)
        .maybeSingle();
    throwIfSupabaseError(projectError);
    if (!project?.client_id)
        return;
    const copy = milestoneDeliveredNotificationCopy(input, (project as {
        title?: string;
    }).title);
    await createMilestoneDeliveredNotification(project.client_id, input, copy.title, copy.body, copy.href, sb);
}
export type ProjectCompletedNotifyInput = {
    projectId: string;
    projectTitle: string;
    statement: string;
    closedByUserId: string;
};
function projectCompletedNotificationCopy(input: ProjectCompletedNotifyInput): {
    title: string;
    body: string;
    href: string;
} {
    const title = input.projectTitle.trim() || "Your project";
    return {
        title: "Engagement formally closed",
        body: `"${title}" has been completed and archived. ${input.statement}`,
        href: projectPath(input.projectId),
    };
}
async function createProjectCompletedNotification(userId: string, input: ProjectCompletedNotifyInput, title: string, body: string, href: string, client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc("create_project_completed_notification", {
        p_user_id: userId,
        p_project_id: input.projectId,
        p_title: title,
        p_body: body,
        p_href: href,
    });
    throwIfSupabaseError(error);
}
export async function notifyProjectCompleted(input: ProjectCompletedNotifyInput, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const [{ data: project, error: projectError }, { data: members, error: membersError }] = await Promise.all([
        sb
            .from("projects")
            .select("client_id, pm_id, title")
            .eq("id", input.projectId)
            .maybeSingle(),
        sb
            .from("project_members")
            .select("user_id")
            .eq("project_id", input.projectId),
    ]);
    throwIfSupabaseError(projectError);
    throwIfSupabaseError(membersError);
    if (!project)
        return;
    const copy = projectCompletedNotificationCopy(input);
    const recipients = new Set<string>();
    if (project.client_id)
        recipients.add(project.client_id);
    if (project.pm_id)
        recipients.add(project.pm_id);
    for (const row of members ?? []) {
        if (row.user_id)
            recipients.add(row.user_id as string);
    }
    recipients.delete(input.closedByUserId);
    await Promise.all([...recipients].map((userId) => createProjectCompletedNotification(userId, input, copy.title, copy.body, copy.href, sb)));
}
export async function notifyWorkReadyAfterProjectTaskChange(projectId: string, previousTasks: TaskNotifySnapshot[], client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const [milestones, currentTasks] = await Promise.all([
        listMilestones(projectId, sb),
        listTasksForProject(projectId, sb),
    ]);
    const after = toTaskNotifySnapshots(currentTasks);
    const candidates = findNewlyReadyAssignedTasks(previousTasks, after, milestones);
    await Promise.all(candidates.map(async (candidate) => {
        const copy = workReadyNotificationCopy(candidate);
        await createWorkReadyNotification(candidate.userId, candidate.task.id, candidate.task.project_id, copy.title, copy.body, copy.href, sb);
    }));
}
export async function snapshotProjectTasksForNotify(projectId: string, client?: SupabaseClient): Promise<TaskNotifySnapshot[]> {
    const sb = resolveClient(client);
    const tasks = await listTasksForProject(projectId, sb);
    return toTaskNotifySnapshots(tasks);
}
