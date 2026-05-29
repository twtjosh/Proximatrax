import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { throwIfSupabaseError } from "@/lib/utils";
import type { ActivityActionType } from "@/types/enums";
import type { ActivityFeedItem, Profile } from "@/types/database";
export type ActivityWithActor = ActivityFeedItem & {
    actor: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
async function attachActors(sb: SupabaseClient, rows: ActivityFeedItem[]): Promise<ActivityWithActor[]> {
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    if (ids.length === 0) {
        return rows.map((r) => ({ ...r, actor: null }));
    }
    const { data: profiles, error } = await sb
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", ids);
    if (error)
        throw error;
    const map = new Map((profiles ?? []).map((p) => [p.id, p as Pick<Profile, "id" | "full_name" | "avatar_url">]));
    return rows.map((r) => ({
        ...r,
        actor: r.user_id ? map.get(r.user_id) ?? null : null,
    }));
}
export async function logActivity(input: {
    project_id: string;
    action_type: ActivityActionType;
    details?: Record<string, unknown>;
}, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { data: { user }, } = await sb.auth.getUser();
    if (!user)
        return;
    const { error } = await sb.from("activity_feed").insert({
        project_id: input.project_id,
        user_id: user.id,
        action_type: input.action_type,
        details: input.details ?? {},
    });
    throwIfSupabaseError(error);
}
export async function listProjectActivity(projectId: string, limit: number, client?: SupabaseClient): Promise<ActivityWithActor[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("activity_feed")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return attachActors(sb, (data ?? []) as ActivityFeedItem[]);
}
export async function listRecentActivityForViewer(limit: number, client?: SupabaseClient): Promise<ActivityWithActor[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("activity_feed")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(limit);
    if (error)
        throw error;
    return attachActors(sb, (data ?? []) as ActivityFeedItem[]);
}
