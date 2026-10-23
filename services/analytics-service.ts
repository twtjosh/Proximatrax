import type { SupabaseClient } from "@supabase/supabase-js";
import { behindSchedule, deliveries, deliveryRecord, lastMonths, managingCount, openLoad, peopleCount, projectRows, toMoves, waitingForReview, type AMilestone, type AProject, type ATask, type DeliveryRecord, type Month, type OpenLoad, type Overrun, type Person, type ProjectRow } from "@/lib/analytics";
import type { FlowPhase, FlowTask } from "@/lib/flow";
import { slimLogRow } from "@/lib/project-log";
import type { TimelineData, TimelineEntry } from "@/lib/project-timeline";
import { personTitle } from "@/lib/vocabulary";
import { readAll } from "@/lib/paged";
import { throwIfSupabaseError } from "@/lib/utils";
import type { CrewClassification, UserRole } from "@/types/enums";

export const PROJECT_COLS = "id, title, pm_id, client_id, status, start_date, end_date, completed_at";
export const TASK_COLS = "id, project_id, milestone_id, title, stage, assigned_to, due_date, completed_at, start_date, created_at, updated_at";
export const MILESTONE_COLS = "id, project_id, title, due_date, completed, completed_at";

type ProfileRow = { id: string; full_name: string; role: UserRole; avatar_url: string | null; classification?: CrewClassification | null };
const person = (p: ProfileRow): Person => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url });

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
    /** Managers running at least one active project. */
    managing: number;
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
        readAll((from, to) => supabase.from("profiles").select("id, full_name, role, avatar_url").order("id").range(from, to)),
        readAll((from, to) => supabase.from("projects").select(PROJECT_COLS).order("id").range(from, to)),
        readAll((from, to) => supabase.from("tasks").select(TASK_COLS).neq("stage", "done").order("id").range(from, to)),
        readAll((from, to) => supabase.from("milestones").select(MILESTONE_COLS).eq("completed", false).order("id").range(from, to)),
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
        ? await readAll((from, to) => supabase.from("activity_feed").select("details, created_at").eq("action_type", "task_moved").eq("details->>to", "review").in("details->>task_id", reviewIds).order("created_at").order("id").range(from, to))
        : { data: [], error: null };
    throwIfSupabaseError(movesRes.error);
    const moves = toMoves(movesRes.data ?? []);

    const byId = new Map(profiles.map((p) => [p.id, p]));
    const pmOf = (id: string): Person => (byId.has(id) ? person(byId.get(id)!) : { id, name: "Unassigned", avatarUrl: null });
    const active = projects.filter((p) => p.status !== "completed");
    const delivered = deliveries(projects);
    const thisYear = delivered.filter((d) => d.date.startsWith(today.slice(0, 4)));

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
        managing: managingCount(projects),
        behind: behindSchedule(active, milestones, today).map((b) => ({ ...b, pm: pmOf(b.project.pm_id) })),
        people: peopleCount(profiles.map((p) => p.role)),
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

export type ManagerProjects = {
    pm: Person;
    rows: { active: ProjectRow[]; delivered: ProjectRow[] };
    clientNames: Record<string, string>;
};

/** One project manager's projects, active and completed, planned against actual: the super admin's way into them. */
export async function loadManagerProjects(supabase: SupabaseClient, pm: { id: string; full_name: string; avatar_url?: string | null }, today: string): Promise<ManagerProjects> {
    const projectsRes = await supabase.from("projects").select(PROJECT_COLS).eq("pm_id", pm.id);
    throwIfSupabaseError(projectsRes.error);
    const projects = (projectsRes.data ?? []) as AProject[];
    const ids = projects.map((p) => p.id);
    const [tasksRes, milestonesRes, clientsRes] = ids.length > 0
        ? await Promise.all([
            readAll((from, to) => supabase.from("tasks").select(TASK_COLS).in("project_id", ids).order("id").range(from, to)),
            readAll((from, to) => supabase.from("milestones").select(MILESTONE_COLS).in("project_id", ids).order("id").range(from, to)),
            supabase.from("profiles").select("id, full_name").in("id", [...new Set(projects.map((p) => p.client_id))]),
        ])
        : [none, none, none];
    for (const r of [tasksRes, milestonesRes, clientsRes])
        throwIfSupabaseError(r.error);
    const clientName = new Map(((clientsRes.data ?? []) as { id: string; full_name: string }[]).map((c) => [c.id, c.full_name]));
    return {
        pm: { id: pm.id, name: pm.full_name, avatarUrl: pm.avatar_url ?? null },
        rows: projectRows(projects, (milestonesRes.data ?? []) as AMilestone[], (tasksRes.data ?? []) as ATask[], today),
        clientNames: Object.fromEntries(projects.map((p) => [p.id, clientName.get(p.client_id) ?? "Client"])),
    };
}

export type PmAnalytics = {
    pm: Person & { firstName: string };
    firstDelivery: string | null;
    delivered: number;
    rows: { active: ProjectRow[]; delivered: ProjectRow[] };
    clientNames: Record<string, string>;
    /** People on the active projects: crew added to them and their clients; `busy` crew hold open tasks. */
    team: { crew: number; clients: number; busy: number };
    /** Raw rows for the Flow charts, which the page filters and counts in the browser (moves too, from the timeline's log). */
    flow: {
        tasks: FlowTask[];
        /** Every phase, so a To do task is timed from when it could start. */
        phases: FlowPhase[];
        /** Active projects first, then delivered; colours follow this order. */
        projects: { id: string; title: string; active: boolean }[];
        crew: Person[];
        /** Each project's log and dates, for the Project timeline. */
        timeline: TimelineData;
    };
};

const none = { data: [], error: null };

/** Everything on one project manager's Analytics page, all time. RLS scopes a PM to their own projects. */
export async function loadPmAnalytics(supabase: SupabaseClient, pm: { id: string; full_name: string; avatar_url?: string | null }, today: string): Promise<PmAnalytics> {
    const projectsRes = await supabase.from("projects").select(PROJECT_COLS).eq("pm_id", pm.id);
    throwIfSupabaseError(projectsRes.error);
    const projects = (projectsRes.data ?? []) as AProject[];
    const ids = projects.map((p) => p.id);
    const activeIds = projects.filter((p) => p.status !== "completed").map((p) => p.id);
    const [tasksRes, milestonesRes, logRes, membersRes] = ids.length > 0
        ? await Promise.all([
            readAll((from, to) => supabase.from("tasks").select(TASK_COLS).in("project_id", ids).order("id").range(from, to)),
            readAll((from, to) => supabase.from("milestones").select(MILESTONE_COLS).in("project_id", ids).order("id").range(from, to)),
            // The whole log: the timeline shows it all, and its task_moved rows are the moves.
            readAll((from, to) => supabase.from("activity_feed").select("project_id, user_id, action_type, details, created_at").in("project_id", ids).order("created_at").order("id").range(from, to)),
            activeIds.length > 0 ? supabase.from("project_members").select("user_id").in("project_id", activeIds) : none,
        ])
        : [none, none, none, none];
    for (const r of [tasksRes, milestonesRes, logRes, membersRes])
        throwIfSupabaseError(r.error);
    const tasks = (tasksRes.data ?? []) as FlowTask[];
    const milestones = (milestonesRes.data ?? []) as AMilestone[];
    const log = ((logRes.data ?? []) as TimelineEntry[]).map(slimLogRow);
    const memberIds = [...new Set(((membersRes.data ?? []) as { user_id: string }[]).map((m) => m.user_id))];

    const peopleIds = [...new Set([...tasks.flatMap((t) => (t.assigned_to ? [t.assigned_to] : [])), ...projects.map((p) => p.client_id), ...log.flatMap((r) => (r.user_id ? [r.user_id] : [])), ...memberIds])];
    const peopleRes = peopleIds.length > 0 ? await supabase.from("profiles").select("id, full_name, role, avatar_url, classification").in("id", peopleIds) : none;
    throwIfSupabaseError(peopleRes.error);
    const people = (peopleRes.data ?? []) as ProfileRow[];
    const nameOf = new Map(people.map((p) => [p.id, p.full_name]));

    const ds = deliveries(projects);
    const rows = projectRows(projects, milestones, tasks, today);
    return {
        pm: { id: pm.id, name: pm.full_name, avatarUrl: pm.avatar_url ?? null, firstName: pm.full_name.split(" ")[0] },
        firstDelivery: ds[0]?.date ?? null,
        delivered: ds.length,
        rows,
        clientNames: Object.fromEntries(projects.map((p) => [p.id, nameOf.get(p.client_id) ?? "Client"])),
        team: (() => {
            const active = new Set(activeIds), roleOf = new Map(people.map((p) => [p.id, p.role]));
            const crew = memberIds.filter((id) => roleOf.get(id) === "middleman");
            const busy = new Set(tasks.filter((t) => active.has(t.project_id) && t.stage !== "done" && t.assigned_to).map((t) => t.assigned_to));
            return { crew: crew.length, clients: new Set(projects.filter((p) => active.has(p.id)).map((p) => p.client_id)).size, busy: crew.filter((id) => busy.has(id)).length };
        })(),
        flow: {
            tasks,
            phases: milestones.map(({ id, project_id, title, due_date }) => ({ id, project_id, title, due_date })),
            projects: [...rows.active, ...rows.delivered].map((r) => ({ id: r.project.id, title: r.project.title, active: r.project.status !== "completed" })),
            crew: people.filter((p) => p.role !== "client" && tasks.some((t) => t.assigned_to === p.id)).sort((a, b) => a.full_name.localeCompare(b.full_name)).map(person),
            timeline: {
                projects: projects.map((p) => ({ id: p.id, title: p.title, client: nameOf.get(p.client_id) ?? "Client", start: p.start_date, end: p.end_date, completedAt: p.completed_at, active: p.status !== "completed" })),
                milestones: milestones.map(({ project_id, title, due_date, completed_at }) => ({ project_id, title, due_date, completed_at })),
                log,
                people: Object.fromEntries(people.map((p) => [p.id, { name: p.full_name, role: personTitle(p), avatarUrl: p.avatar_url }])),
            },
        },
    };
}
