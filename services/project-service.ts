import type { SupabaseClient } from "@supabase/supabase-js";
import { shouldAutoCompleteMilestone, shouldAutoReopenMilestone, toGateTasks, } from "@/lib/milestone-task-gates";
import { assessProjectClosureReadiness, DEFAULT_COMPLETION_STATEMENT, isProjectArchived, } from "@/lib/project-lifecycle";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { throwIfSupabaseError } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { notifyClientMilestoneDelivered, notifyProjectCompleted, } from "@/services/work-notification-service";
import type { Milestone, Profile, Project } from "@/types/database";
import type { ProjectStatus } from "@/types/enums";
export type ProjectRelatedProfile = Pick<Profile, "id" | "full_name" | "avatar_url" | "role">;
export type ProjectWithRelations = Project & {
    pm: ProjectRelatedProfile | null;
    client: ProjectRelatedProfile | null;
    milestones?: Milestone[];
};
export type ProjectListFilters = {
    status?: ProjectStatus;
    lifecycle?: "active" | "completed";
    search?: string;
    pmId?: string;
    clientId?: string;
};
export type CreateProjectInput = {
    title: string;
    description?: string | null;
    status?: ProjectStatus;
    client_id: string;
    pm_id: string;
    start_date: string;
    end_date: string;
};
export type UpdateProjectInput = Partial<Omit<CreateProjectInput, "client_id" | "pm_id">> & {
    id: string;
    client_id?: string;
    pm_id?: string;
};
const PROJECT_RELATIONS_SELECT = `
  *,
  pm:profiles!projects_pm_fk ( id, full_name, avatar_url, role ),
  client:profiles!projects_client_fk ( id, full_name, avatar_url, role )
`;
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export async function assertProjectNotArchived(projectId: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("projects")
        .select("status")
        .eq("id", projectId)
        .maybeSingle();
    throwIfSupabaseError(error);
    if (data && isProjectArchived(data as Project)) {
        throw new Error("This engagement is formally closed and read-only.");
    }
}
export async function listProjects(client?: SupabaseClient, filters: ProjectListFilters = {}): Promise<ProjectWithRelations[]> {
    const sb = resolveClient(client);
    let query = sb
        .from("projects")
        .select(PROJECT_RELATIONS_SELECT)
        .order("created_at", { ascending: false });
    if (filters.status)
        query = query.eq("status", filters.status);
    if (filters.lifecycle === "completed") {
        query = query.eq("status", "completed");
    }
    else if (filters.lifecycle === "active") {
        query = query.neq("status", "completed");
    }
    if (filters.pmId)
        query = query.eq("pm_id", filters.pmId);
    if (filters.clientId)
        query = query.eq("client_id", filters.clientId);
    if (filters.search)
        query = query.ilike("title", `%${filters.search}%`);
    const { data, error } = await query;
    throwIfSupabaseError(error);
    return (data ?? []) as unknown as ProjectWithRelations[];
}
export async function getProjectById(id: string, client?: SupabaseClient, options?: {
    withMilestones?: boolean;
}): Promise<ProjectWithRelations | null> {
    const sb = resolveClient(client);
    const select = options?.withMilestones === true
        ? `${PROJECT_RELATIONS_SELECT}, milestones ( * )`
        : PROJECT_RELATIONS_SELECT;
    const { data, error } = await sb
        .from("projects")
        .select(select)
        .eq("id", id)
        .maybeSingle();
    throwIfSupabaseError(error);
    return (data as unknown as ProjectWithRelations) ?? null;
}
export async function createProject(input: CreateProjectInput, client?: SupabaseClient): Promise<Project> {
    if (input.end_date < input.start_date) {
        throw new Error("End date must be on or after the start date.");
    }
    const sb = resolveClient(client);
    const payload = {
        id: crypto.randomUUID(),
        title: input.title.trim(),
        description: input.description?.trim() || null,
        status: input.status ?? "planning",
        client_id: input.client_id,
        pm_id: input.pm_id,
        start_date: input.start_date,
        end_date: input.end_date,
    };
    const { error: insertError } = await sb.from("projects").insert(payload);
    throwIfSupabaseError(insertError);
    const { data, error: readError } = await sb
        .from("projects")
        .select("*")
        .eq("id", payload.id)
        .maybeSingle();
    throwIfSupabaseError(readError);
    if (!data) {
        throw new Error("Project was saved but could not be loaded. Check projects RLS policies.");
    }
    return data as Project;
}
export async function addProjectMember(input: {
    project_id: string;
    user_id: string;
    role_in_project?: string;
}, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb.from("project_members").insert({
        project_id: input.project_id,
        user_id: input.user_id,
        role_in_project: input.role_in_project ?? "middleman",
    });
    throwIfSupabaseError(error);
}
export async function updateProject(input: UpdateProjectInput, client?: SupabaseClient): Promise<Project> {
    const sb = resolveClient(client);
    const { id, ...rest } = input;
    if (rest.start_date && rest.end_date && rest.end_date < rest.start_date) {
        throw new Error("End date must be on or after the start date.");
    }
    const { data, error } = await sb
        .from("projects")
        .update(rest)
        .eq("id", id)
        .select("*")
        .single();
    throwIfSupabaseError(error);
    return data as Project;
}
export async function completeProject(projectId: string, completedBy: string, completionStatement?: string, client?: SupabaseClient): Promise<Project> {
    const sb = resolveClient(client);
    const project = await getProjectById(projectId, sb, { withMilestones: true });
    if (!project)
        throw new Error("Project not found.");
    const { data: taskRows, error: taskError } = await sb
        .from("tasks")
        .select("stage")
        .eq("project_id", projectId);
    throwIfSupabaseError(taskError);
    const readiness = assessProjectClosureReadiness(project, project.milestones ?? [], (taskRows ?? []) as Array<{
        stage: import("@/types/enums").TaskStage;
    }>);
    if (!readiness.ready) {
        throw new Error(readiness.blockers[0] ?? "Project is not ready to close.");
    }
    const now = new Date().toISOString();
    const statement = completionStatement?.trim() || DEFAULT_COMPLETION_STATEMENT;
    const { data, error } = await sb
        .from("projects")
        .update({
        status: "completed",
        completed_at: now,
        completed_by: completedBy,
        completion_statement: statement,
    })
        .eq("id", projectId)
        .select("*")
        .single();
    throwIfSupabaseError(error);
    const closed = data as Project;
    try {
        await logActivity({
            project_id: projectId,
            action_type: "project_completed",
            details: {
                title: project.title,
                statement,
            },
        }, sb);
    }
    catch {
        await logActivity({
            project_id: projectId,
            action_type: "status_changed",
            details: {
                title: project.title,
                statement,
                formally_closed: true,
                to: "completed",
            },
        }, sb);
    }
    try {
        await notifyProjectCompleted({
            projectId,
            projectTitle: project.title,
            statement,
            closedByUserId: completedBy,
        }, sb);
    }
    catch {
    }
    return closed;
}
export async function reopenProject(projectId: string, client?: SupabaseClient): Promise<Project> {
    const sb = resolveClient(client);
    const project = await getProjectById(projectId, sb);
    if (!project)
        throw new Error("Project not found.");
    if (!isProjectArchived(project)) {
        throw new Error("Only closed engagements can be reopened.");
    }
    const { data, error } = await sb
        .from("projects")
        .update({
        status: "in_progress",
        completed_at: null,
        completed_by: null,
        completion_statement: null,
    })
        .eq("id", projectId)
        .select("*")
        .single();
    throwIfSupabaseError(error);
    await logActivity({
        project_id: projectId,
        action_type: "status_changed",
        details: {
            title: project.title,
            from: "completed",
            to: "in_progress",
            reopened: true,
        },
    }, sb);
    return data as Project;
}
export async function deleteProject(id: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb.from("projects").delete().eq("id", id);
    throwIfSupabaseError(error);
}
export async function listProfilesByRoles(roles: Profile["role"][], client?: SupabaseClient): Promise<Profile[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("profiles")
        .select("*")
        .in("role", roles)
        .order("full_name", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Profile[];
}
export async function createMilestone(input: {
    project_id: string;
    title: string;
    due_date: string;
    completed?: boolean;
}, client?: SupabaseClient): Promise<Milestone> {
    const sb = resolveClient(client);
    await assertProjectNotArchived(input.project_id, sb);
    const { data, error } = await sb
        .from("milestones")
        .insert({
        project_id: input.project_id,
        title: input.title.trim(),
        due_date: input.due_date,
        completed: input.completed ?? false,
    })
        .select("*")
        .single();
    throwIfSupabaseError(error);
    return data as Milestone;
}
export type UpdateMilestoneInput = {
    id: string;
    title?: string;
    due_date?: string;
    completed?: boolean;
    deliverySource?: "auto" | "manual";
};
export async function updateMilestone(input: UpdateMilestoneInput, client?: SupabaseClient): Promise<Milestone> {
    const sb = resolveClient(client);
    const { id, deliverySource, ...rest } = input;
    const { data: before, error: beforeError } = await sb
        .from("milestones")
        .select("completed, title, project_id")
        .eq("id", id)
        .maybeSingle();
    throwIfSupabaseError(beforeError);
    if (before?.project_id) {
        await assertProjectNotArchived(before.project_id, sb);
    }
    const payload: Record<string, unknown> = {};
    if (rest.title !== undefined)
        payload.title = rest.title.trim();
    if (rest.due_date !== undefined)
        payload.due_date = rest.due_date;
    if (rest.completed !== undefined)
        payload.completed = rest.completed;
    const { data, error } = await sb
        .from("milestones")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
    throwIfSupabaseError(error);
    const milestone = data as Milestone;
    if (rest.completed === true &&
        before &&
        !before.completed &&
        before.project_id) {
        await notifyClientMilestoneDelivered({
            projectId: before.project_id,
            milestoneId: id,
            milestoneTitle: milestone.title,
            source: deliverySource ?? "manual",
        }, sb);
    }
    return milestone;
}
export async function deleteMilestone(id: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { data: milestone, error: lookupError } = await sb
        .from("milestones")
        .select("project_id")
        .eq("id", id)
        .maybeSingle();
    throwIfSupabaseError(lookupError);
    if (milestone?.project_id) {
        await assertProjectNotArchived(milestone.project_id, sb);
    }
    const { error } = await sb.from("milestones").delete().eq("id", id);
    throwIfSupabaseError(error);
}
export async function listMilestones(projectId: string, client?: SupabaseClient): Promise<Milestone[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("milestones")
        .select("*")
        .eq("project_id", projectId)
        .order("due_date", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as Milestone[];
}
export async function syncMilestoneFromLinkedTasks(projectId: string, milestoneId: string | null | undefined, client?: SupabaseClient): Promise<{
    completed: boolean;
    reopened: boolean;
    title?: string;
}> {
    if (!milestoneId)
        return { completed: false, reopened: false };
    const sb = resolveClient(client);
    const { data: taskRows, error: taskError } = await sb
        .from("tasks")
        .select("id, milestone_id, stage")
        .eq("project_id", projectId)
        .eq("milestone_id", milestoneId);
    throwIfSupabaseError(taskError);
    const linked = toGateTasks(taskRows ?? []);
    if (linked.length === 0)
        return { completed: false, reopened: false };
    const { data: milestone, error: milestoneError } = await sb
        .from("milestones")
        .select("id, title, completed")
        .eq("id", milestoneId)
        .maybeSingle();
    throwIfSupabaseError(milestoneError);
    if (!milestone)
        return { completed: false, reopened: false };
    if (shouldAutoCompleteMilestone(milestoneId, linked) && !milestone.completed) {
        await updateMilestone({ id: milestoneId, completed: true, deliverySource: "auto" }, sb);
        await logActivity({
            project_id: projectId,
            action_type: "milestone_completed",
            details: {
                milestone_id: milestoneId,
                title: milestone.title,
                auto: true,
            },
        }, sb);
        return { completed: true, reopened: false, title: milestone.title };
    }
    if (shouldAutoReopenMilestone(milestoneId, linked) && milestone.completed) {
        await updateMilestone({ id: milestoneId, completed: false }, sb);
        return { completed: false, reopened: true, title: milestone.title };
    }
    return { completed: false, reopened: false };
}
export const DEFAULT_LIFECYCLE_TEMPLATE = [
    "Site Survey",
    "Design Approval",
    "Site Preparation",
    "Construction",
    "Handover",
] as const;
function toIsoDate(d: Date): string {
    return d.toISOString().slice(0, 10);
}
export async function seedDefaultMilestones(projectId: string, startDate: string, endDate: string, client?: SupabaseClient): Promise<Milestone[]> {
    const start = new Date(`${startDate}T00:00:00Z`);
    const end = new Date(`${endDate}T00:00:00Z`);
    const totalMs = end.getTime() - start.getTime();
    if (Number.isNaN(totalMs) || totalMs < 0) {
        throw new Error("Cannot seed milestones: invalid project date range.");
    }
    const titles = DEFAULT_LIFECYCLE_TEMPLATE;
    const rows = titles.map((title, i) => {
        const fraction = (i + 1) / titles.length;
        const due = new Date(start.getTime() + fraction * totalMs);
        return {
            project_id: projectId,
            title,
            due_date: toIsoDate(due),
            completed: false,
        };
    });
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("milestones")
        .insert(rows)
        .select("*");
    throwIfSupabaseError(error);
    return (data ?? []) as Milestone[];
}
