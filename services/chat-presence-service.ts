import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Profile, ProjectChatReadCursor } from "@/types/database";
export type ChatParticipant = Pick<Profile, "id" | "full_name" | "avatar_url">;
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export async function listProjectChatParticipants(projectId: string, client?: SupabaseClient): Promise<ChatParticipant[]> {
    const sb = resolveClient(client);
    const { data: project, error: projectError } = await sb
        .from("projects")
        .select("pm_id, client_id")
        .eq("id", projectId)
        .maybeSingle();
    if (projectError)
        throw projectError;
    if (!project)
        return [];
    const userIds = new Set<string>();
    if (project.pm_id)
        userIds.add(project.pm_id as string);
    if (project.client_id)
        userIds.add(project.client_id as string);
    const { data: members, error: membersError } = await sb
        .from("project_members")
        .select("user_id")
        .eq("project_id", projectId);
    if (membersError)
        throw membersError;
    for (const row of members ?? []) {
        if (row.user_id)
            userIds.add(row.user_id as string);
    }
    if (userIds.size === 0)
        return [];
    const { data: profiles, error: profilesError } = await sb
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", [...userIds]);
    if (profilesError)
        throw profilesError;
    return (profiles ?? []) as ChatParticipant[];
}
export async function listProjectChatReadCursors(projectId: string, client?: SupabaseClient): Promise<ProjectChatReadCursor[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("project_chat_read_cursors")
        .select("*")
        .eq("project_id", projectId);
    if (error)
        throw error;
    return (data ?? []) as ProjectChatReadCursor[];
}
export async function markProjectChatRead(projectId: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { data: { user }, } = await sb.auth.getUser();
    if (!user)
        return;
    const now = new Date().toISOString();
    const { error } = await sb.from("project_chat_read_cursors").upsert({
        project_id: projectId,
        user_id: user.id,
        last_read_at: now,
    }, { onConflict: "project_id,user_id" });
    if (error)
        throw error;
}
export async function countUnreadChatMessages(projectId: string, userId: string, client?: SupabaseClient): Promise<number> {
    const sb = resolveClient(client);
    const { data: cursor, error: cursorError } = await sb
        .from("project_chat_read_cursors")
        .select("last_read_at")
        .eq("project_id", projectId)
        .eq("user_id", userId)
        .maybeSingle();
    if (cursorError)
        throw cursorError;
    let query = sb
        .from("chat_messages")
        .select("id", { count: "exact", head: true })
        .eq("project_id", projectId)
        .neq("sender_id", userId);
    if (cursor?.last_read_at) {
        query = query.gt("created_at", cursor.last_read_at);
    }
    const { count, error } = await query;
    if (error)
        throw error;
    return count ?? 0;
}
