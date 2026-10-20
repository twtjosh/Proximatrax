import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient, signedInUser } from "@/lib/supabase/client";
import { throwIfSupabaseError } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import type { Profile, TaskComment } from "@/types/database";

export type TaskCommentWithAuthor = TaskComment & {
    author: Pick<Profile, "id" | "full_name" | "avatar_url" | "role" | "classification"> | null;
};

const SELECT = "*, author:profiles!task_comments_author_id_fkey ( id, full_name, avatar_url, role, classification )";

function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}

/** A task's discussion, oldest first. */
export async function listTaskComments(taskId: string, client?: SupabaseClient): Promise<TaskCommentWithAuthor[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb.from("task_comments").select(SELECT).eq("task_id", taskId).order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    return (data ?? []) as TaskCommentWithAuthor[];
}

/** How many comments each task has, for the counts on cards and rows. */
export async function countTaskComments(projectId: string, client?: SupabaseClient): Promise<Record<string, number>> {
    const sb = resolveClient(client);
    const { data, error } = await sb.from("task_comments").select("task_id").eq("project_id", projectId);
    // Before migration 0024 the table doesn't exist; counts are a nicety, not worth failing the page.
    if (error)
        return {};
    const counts: Record<string, number> = {};
    for (const row of (data ?? []) as { task_id: string }[])
        counts[row.task_id] = (counts[row.task_id] ?? 0) + 1;
    return counts;
}

export async function addTaskComment(input: { taskId: string; projectId: string; taskTitle: string; body: string }, client?: SupabaseClient): Promise<TaskCommentWithAuthor> {
    const sb = resolveClient(client);
    const user = await signedInUser(sb);
    if (!user)
        throw new Error("Not signed in.");
    const { data, error } = await sb
        .from("task_comments")
        .insert({ task_id: input.taskId, project_id: input.projectId, author_id: user.id, body: input.body.trim() })
        .select(SELECT)
        .single();
    throwIfSupabaseError(error);
    void logActivity({ project_id: input.projectId, action_type: "comment_added", details: { task_id: input.taskId, title: input.taskTitle, excerpt: input.body.trim().slice(0, 140) } }, sb).catch(() => undefined);
    return data as TaskCommentWithAuthor;
}

export async function deleteTaskComment(id: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb.from("task_comments").delete().eq("id", id);
    throwIfSupabaseError(error);
}
