import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient, signedInUser } from "@/lib/supabase/client";
import { readAll } from "@/lib/paged";
import { isChatRow } from "@/lib/project-log";
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
    const userId = (await signedInUser(sb))?.id;
    if (!userId)
        return;
    const { error } = await sb.from("activity_feed").insert({
        project_id: input.project_id,
        user_id: userId,
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
/** One page of a project's log, newest first; `before` continues from the last row shown. */
export async function listProjectActivityPage(projectId: string, options: { limit: number; before?: string; taskId?: string }, client?: SupabaseClient): Promise<ActivityWithActor[]> {
    const sb = resolveClient(client);
    let query = sb
        .from("activity_feed")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false })
        .limit(options.limit);
    if (options.before)
        query = query.lt("created_at", options.before);
    if (options.taskId)
        query = query.eq("details->>task_id", options.taskId);
    const { data, error } = await query;
    if (error)
        throw error;
    return attachActors(sb, (data ?? []) as ActivityFeedItem[]);
}
export type LogActor = Pick<Profile, "id" | "full_name" | "avatar_url" | "role" | "classification">;
/**
 * A project's whole log, oldest first, without in-app chat, and everyone in
 * it with their role: the Activity log report. Paged so long projects come
 * back complete.
 */
export async function listProjectLog(projectId: string, client?: SupabaseClient): Promise<{ rows: ActivityFeedItem[]; people: Record<string, LogActor> }> {
    const sb = resolveClient(client);
    const { data, error } = await readAll<ActivityFeedItem>((from, to) => sb.from("activity_feed").select("*").eq("project_id", projectId).order("created_at").order("id").range(from, to));
    throwIfSupabaseError(error);
    const rows = data.filter((r) => !isChatRow(r));
    const ids = [...new Set(rows.map((r) => r.user_id).filter(Boolean))] as string[];
    const people: Record<string, LogActor> = {};
    if (ids.length) {
        const { data: profiles, error: peopleError } = await sb.from("profiles").select("id, full_name, avatar_url, role, classification").in("id", ids);
        throwIfSupabaseError(peopleError);
        for (const p of (profiles ?? []) as LogActor[])
            people[p.id] = p;
    }
    return { rows, people };
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
