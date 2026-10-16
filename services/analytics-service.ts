import type { SupabaseClient } from "@supabase/supabase-js";
import { behindSchedule, deliveries, deliveryRecord, lastMonths, openLoad, waitingForReview, type AMilestone, type AProject, type ATask, type DeliveryRecord, type Month, type OpenLoad, type Overrun, type Person, type TaskMove } from "@/lib/analytics";
import { throwIfSupabaseError } from "@/lib/utils";
import type { UserRole } from "@/types/enums";

export const PROJECT_COLS = "id, title, pm_id, client_id, status, start_date, end_date, completed_at";
export const TASK_COLS = "id, project_id, title, stage, assigned_to, due_date, completed_at, updated_at";
export const MILESTONE_COLS = "id, project_id, title, due_date, completed, completed_at";

type ProfileRow = { id: string; full_name: string; role: UserRole; avatar_url: string | null };
const person = (p: ProfileRow): Person => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url });

/** `task_moved` rows from the activity feed, as moves. Rows missing a field are skipped. */
export function toMoves(rows: { details: unknown; created_at: string }[]): TaskMove[] {
    return rows.flatMap((r) => {
        const d = (r.details ?? {}) as { task_id?: string; from?: string; to?: string };
        return d.task_id && d.from && d.to ? [{ task_id: d.task_id, from: d.from, to: d.to, at: r.created_at }] : [];
    });
}

export type ManagerLane = Person & {
    active: number;
    behind: number;
    load: OpenLoad;
    oldestReviewDays: number | null;
    /** This year's deliveries. */
    record: DeliveryRecord;
    dots: { title: string; late: number }[];
};

export type OwnerAnalytics = {
    activeCount: number;
    behind: (Overrun & { project: AProject; pm: Person })[];
    people: { total: number; pm: number; crew: number; client: number };
    /** This year's deliveries across every manager. */
    year: DeliveryRecord;
    managers: ManagerLane[];
    months: (Month & { deliveries: { title: string; pmId: string; pmName: string; late: number }[] })[];
};

/**
 * Everything on the owner's Overview. RLS lets the super admin read every row.
 * ponytail: reads all projects and open work and aggregates here; move to SQL views past ~10k rows.
 */
export async function loadOwnerAnalytics(supabase: SupabaseClient, today: string): Promise<OwnerAnalytics> {
    const [profilesRes, projectsRes, tasksRes, milestonesRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role, avatar_url"),
        supabase.from("projects").select(PROJECT_COLS),
        supabase.from("tasks").select(TASK_COLS).neq("stage", "done"),
        supabase.from("milestones").select(MILESTONE_COLS).eq("completed", false),
    ]);
    for (const r of [profilesRes, projectsRes, tasksRes, milestonesRes])
        throwIfSupabaseError(r.error);
    const profiles = (profilesRes.data ?? []) as ProfileRow[];
    const projects = (projectsRes.data ?? []) as AProject[];
    const tasks = (tasksRes.data ?? []) as ATask[];
    const milestones = (milestonesRes.data ?? []) as AMilestone[];

    // Only submissions still waiting need a date, so only their moves are read.
    const reviewIds = tasks.filter((t) => t.stage === "review").map((t) => t.id);
    const movesRes = reviewIds.length > 0
        ? await supabase.from("activity_feed").select("details, created_at").eq("action_type", "task_moved").eq("details->>to", "review").in("details->>task_id", reviewIds)
        : { data: [], error: null };
    throwIfSupabaseError(movesRes.error);
    const moves = toMoves(movesRes.data ?? []);

    const byId = new Map(profiles.map((p) => [p.id, p]));
    const pmOf = (id: string): Person => (byId.has(id) ? person(byId.get(id)!) : { id, name: "Unassigned", avatarUrl: null });
    const active = projects.filter((p) => p.status !== "completed");
    const delivered = deliveries(projects);
    const thisYear = delivered.filter((d) => d.date.startsWith(today.slice(0, 4)));
    const count = (role: UserRole) => profiles.filter((p) => p.role === role).length;

    const managers: ManagerLane[] = profiles
        .filter((p) => p.role === "project_manager")
        .sort((a, b) => a.full_name.localeCompare(b.full_name))
        .map((pm) => {
            const mine = active.filter((p) => p.pm_id === pm.id);
            const ids = new Set(mine.map((p) => p.id));
            const myTasks = tasks.filter((t) => ids.has(t.project_id));
            const myYear = thisYear.filter((d) => d.project.pm_id === pm.id);
            return {
                ...person(pm),
                active: mine.length,
                behind: behindSchedule(mine, milestones, today).length,
                load: openLoad(myTasks, today),
                oldestReviewDays: waitingForReview(myTasks, moves, today)[0]?.days ?? null,
                record: deliveryRecord(myYear),
                dots: myYear.map((d) => ({ title: d.project.title, late: d.late })),
            };
        });

    return {
        activeCount: active.length,
        behind: behindSchedule(active, milestones, today).map((b) => ({ ...b, pm: pmOf(b.project.pm_id) })),
        people: { total: profiles.length, pm: count("project_manager"), crew: count("middleman"), client: count("client") },
        year: deliveryRecord(thisYear),
        managers,
        months: lastMonths(today).map((m) => ({
            ...m,
            deliveries: delivered
                .filter((d) => d.date.startsWith(m.key))
                .map((d) => ({ title: d.project.title, pmId: d.project.pm_id, pmName: pmOf(d.project.pm_id).name, late: d.late })),
        })),
    };
}
