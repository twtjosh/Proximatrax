import type { SupabaseClient } from "@supabase/supabase-js";
import { behindSchedule, crewRecord, deliveries, deliveryRecord, lastMonths, milestoneRecord, openLoad, projectRows, reviewTurnaround, taskCounts, waitingForReview, type AMilestone, type AProject, type ATask, type CrewRow, type DeliveryRecord, type MilestoneRecord, type Month, type OpenLoad, type Overrun, type Person, type ProjectRow, type TaskCounts, type TaskMove, type Waiting } from "@/lib/analytics";
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

export type PmAnalytics = {
    pm: Person & { firstName: string };
    firstDelivery: string | null;
    rows: { active: ProjectRow[]; delivered: ProjectRow[] };
    clientNames: Record<string, string>;
    record: DeliveryRecord;
    dots: { title: string; late: number }[];
    milestones: MilestoneRecord;
    tasks: TaskCounts;
    behind: string[];
    crew: CrewRow[];
    turnaround: number | null;
    waiting: (Waiting & { projectTitle: string; crewName: string | null })[];
};

const none = { data: [], error: null };

/** Everything on one project manager's Analytics page, all time. RLS scopes a PM to their own projects. */
export async function loadPmAnalytics(supabase: SupabaseClient, pm: { id: string; full_name: string; avatar_url?: string | null }, today: string): Promise<PmAnalytics> {
    const projectsRes = await supabase.from("projects").select(PROJECT_COLS).eq("pm_id", pm.id);
    throwIfSupabaseError(projectsRes.error);
    const projects = (projectsRes.data ?? []) as AProject[];
    const ids = projects.map((p) => p.id);
    const [tasksRes, milestonesRes, movesRes] = ids.length > 0
        ? await Promise.all([
            supabase.from("tasks").select(TASK_COLS).in("project_id", ids),
            supabase.from("milestones").select(MILESTONE_COLS).in("project_id", ids),
            supabase.from("activity_feed").select("details, created_at").eq("action_type", "task_moved").in("project_id", ids),
        ])
        : [none, none, none];
    for (const r of [tasksRes, milestonesRes, movesRes])
        throwIfSupabaseError(r.error);
    const tasks = (tasksRes.data ?? []) as ATask[];
    const milestones = (milestonesRes.data ?? []) as AMilestone[];
    const moves = toMoves(movesRes.data ?? []);

    const peopleIds = [...new Set([...tasks.flatMap((t) => (t.assigned_to ? [t.assigned_to] : [])), ...projects.map((p) => p.client_id)])];
    const peopleRes = peopleIds.length > 0 ? await supabase.from("profiles").select("id, full_name, role, avatar_url").in("id", peopleIds) : none;
    throwIfSupabaseError(peopleRes.error);
    const people = (peopleRes.data ?? []) as ProfileRow[];
    const nameOf = new Map(people.map((p) => [p.id, p.full_name]));
    const titleOf = new Map(projects.map((p) => [p.id, p.title]));

    const ds = deliveries(projects);
    const rows = projectRows(projects, milestones, tasks, today);
    return {
        pm: { id: pm.id, name: pm.full_name, avatarUrl: pm.avatar_url ?? null, firstName: pm.full_name.split(" ")[0] },
        firstDelivery: ds[0]?.date ?? null,
        rows,
        clientNames: Object.fromEntries(projects.map((p) => [p.id, nameOf.get(p.client_id) ?? "Client"])),
        record: deliveryRecord(ds),
        dots: ds.map((d) => ({ title: d.project.title, late: d.late })),
        milestones: milestoneRecord(milestones, today),
        tasks: taskCounts(tasks, today),
        behind: rows.active.filter((r) => r.result.kind === "past_end" || r.result.kind === "milestone_late").map((r) => r.project.title),
        crew: crewRecord(people.filter((p) => p.role === "middleman").map(person), tasks, moves, today),
        turnaround: reviewTurnaround(moves, today),
        waiting: waitingForReview(tasks, moves, today).map((w) => ({
            ...w,
            projectTitle: titleOf.get(w.task.project_id) ?? "",
            crewName: w.task.assigned_to ? nameOf.get(w.task.assigned_to) ?? null : null,
        })),
    };
}
