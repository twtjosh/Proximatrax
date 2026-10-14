import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * In-progress tasks the PM returned from review, with when. A return is logged
 * as a move from review to in progress; a task still in progress after one is
 * waiting to be fixed and resubmitted. Only decorates pages, so failures
 * yield nothing.
 */
export async function loadSentBack(supabase: SupabaseClient, tasks: { id: string; project_id: string; stage: string }[]): Promise<Record<string, string>> {
    const underway = new Set(tasks.filter((t) => t.stage === "in_progress").map((t) => t.id));
    if (underway.size === 0)
        return {};
    const { data } = await supabase
        .from("activity_feed")
        .select("details, created_at")
        .eq("action_type", "task_moved")
        .eq("details->>from", "review")
        .eq("details->>to", "in_progress")
        .in("project_id", [...new Set(tasks.map((t) => t.project_id))])
        .order("created_at", { ascending: false });
    const returned: Record<string, string> = {};
    for (const row of (data ?? []) as { details: { task_id?: string }; created_at: string }[]) {
        const id = row.details?.task_id;
        if (id && underway.has(id) && !returned[id])
            returned[id] = row.created_at;
    }
    return returned;
}
