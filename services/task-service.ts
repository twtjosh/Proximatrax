import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { assertProjectNotArchived } from "@/services/project-service";
import type { Task, Milestone } from "@/types/database";
import type { TaskStage, TaskPriority } from "@/types/enums";
export type TaskAssignee = {
    id: string;
    full_name: string;
    avatar_url: string | null;
};
export type TaskWithRelations = Task & {
    assignee: TaskAssignee | null;
    milestone: Pick<Milestone, "id" | "title"> | null;
};
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
const TASK_SELECT = `
  *,
  assignee:profiles!tasks_assigned_to_fkey ( id, full_name, avatar_url ),
  milestone:milestones ( id, title )
`;
export async function listTasksForProject(projectId: string, client?: SupabaseClient): Promise<TaskWithRelations[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("tasks")
        .select(TASK_SELECT)
        .eq("project_id", projectId)
        .order("position", { ascending: true });
    if (error)
        throw error;
    return (data ?? []) as unknown as TaskWithRelations[];
}
export type CreateTaskInput = {
    project_id: string;
    title: string;
    description?: string | null;
    stage?: TaskStage;
    milestone_id?: string | null;
    assigned_to?: string | null;
    priority?: TaskPriority;
    due_date?: string | null;
};
export async function createTask(input: CreateTaskInput, client?: SupabaseClient): Promise<Task> {
    const sb = resolveClient(client);
    await assertProjectNotArchived(input.project_id, sb);
    const stage = input.stage ?? "to_do";
    const { data: maxRow } = await sb
        .from("tasks")
        .select("position")
        .eq("project_id", input.project_id)
        .eq("stage", stage)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
    const nextPosition = (maxRow?.position ?? -1) + 1;
    const { data, error } = await sb
        .from("tasks")
        .insert({
        project_id: input.project_id,
        title: input.title.trim(),
        description: input.description?.trim() || null,
        stage,
        milestone_id: input.milestone_id ?? null,
        assigned_to: input.assigned_to ?? null,
        priority: input.priority ?? "medium",
        due_date: input.due_date ?? null,
        position: nextPosition,
    })
        .select("*")
        .single();
    if (error)
        throw error;
    return data as Task;
}
export type UpdateTaskInput = {
    id: string;
    title?: string;
    description?: string | null;
    stage?: TaskStage;
    milestone_id?: string | null;
    assigned_to?: string | null;
    priority?: TaskPriority;
    due_date?: string | null;
    position?: number;
    checklist?: unknown;
    client_visible_at?: string | null;
};
export async function updateTask(input: UpdateTaskInput, client?: SupabaseClient): Promise<Task> {
    const sb = resolveClient(client);
    const { id, ...rest } = input;
    const { data: existing, error: lookupError } = await sb
        .from("tasks")
        .select("project_id")
        .eq("id", id)
        .maybeSingle();
    if (lookupError)
        throw lookupError;
    if (existing?.project_id) {
        await assertProjectNotArchived(existing.project_id as string, sb);
    }
    const payload: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(rest)) {
        if (v !== undefined)
            payload[k] = v;
    }
    if (payload.title !== undefined)
        payload.title = String(payload.title).trim();
    const { data, error } = await sb
        .from("tasks")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
    if (error)
        throw error;
    return data as Task;
}
export async function deleteTask(id: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb.from("tasks").delete().eq("id", id);
    if (error)
        throw error;
}
export type TaskWithProject = TaskWithRelations & {
    project: {
        id: string;
        title: string;
    };
};
export async function listAssignedTasksForUser(userId: string, client?: SupabaseClient): Promise<TaskWithProject[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("tasks")
        .select(`${TASK_SELECT}, project:projects!tasks_project_id_fkey ( id, title )`)
        .eq("assigned_to", userId)
        .in("stage", ["backlog", "to_do", "in_progress", "review"])
        .order("due_date", { ascending: true, nullsFirst: false });
    if (error)
        throw error;
    return (data ?? []) as unknown as TaskWithProject[];
}
export async function listClientVisibleDeliverables(projectId: string, client?: SupabaseClient): Promise<TaskWithRelations[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("tasks")
        .select(TASK_SELECT)
        .eq("project_id", projectId)
        .not("client_visible_at", "is", null)
        .order("client_visible_at", { ascending: false });
    if (error)
        throw error;
    return (data ?? []) as unknown as TaskWithRelations[];
}
