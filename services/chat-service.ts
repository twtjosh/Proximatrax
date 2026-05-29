import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { ChatMessage } from "@/types/database";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export async function listChatMessages(projectId: string, limit: number, client?: SupabaseClient): Promise<ChatMessage[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("chat_messages")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    const rows = (data ?? []) as ChatMessage[];
    return rows.slice().reverse();
}
export async function sendChatMessage(projectId: string, content: string, client?: SupabaseClient): Promise<ChatMessage> {
    const sb = resolveClient(client);
    const { data: { user }, } = await sb.auth.getUser();
    if (!user)
        throw new Error("Not authenticated.");
    const { data, error } = await sb
        .from("chat_messages")
        .insert({
        project_id: projectId,
        sender_id: user.id,
        content: content.trim(),
    })
        .select("*")
        .single();
    if (error)
        throw error;
    return data as ChatMessage;
}
