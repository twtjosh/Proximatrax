import type { Milestone, Task } from "../types/database";

/**
 * Pure derivations behind the project manager dashboard. Every rule here
 * restates one the app already applies elsewhere: work is accepted when its
 * stage is "done", waits on the PM while in "review", and is overdue when it
 * is still open after its due date. Nothing new is decided here.
 *
 * Relative, type-only imports keep this file runnable by `node --test`.
 */
export type DashboardTask = Pick<Task, "id" | "title" | "project_id" | "stage" | "due_date" | "client_visible_at" | "updated_at"> & {
    /** Loaded where the Overview shows who is doing what. */
    assigned_to?: string | null;
};
export type DashboardMilestone = Pick<Milestone, "id" | "title" | "project_id" | "due_date" | "completed">;

export type Deadline = {
    kind: "task" | "milestone";
    id: string;
    project_id: string;
    title: string;
    due_date: string;
};

/** Task counts per board column (backlog is shown as To do). */
export type StageCounts = Record<"to_do" | "in_progress" | "review" | "done", number>;

export type ProjectLoad = {
    tasksTotal: number;
    stages: StageCounts;
    inReview: DashboardTask[];
    overdue: number;
    /** Earliest open deadline, which may already be late. */
    nextDeadline: Deadline | null;
};

const DAY_MS = 86_400_000;

/** AEG works in Manila; "today", and so what counts as overdue, is measured there. */
export const BUSINESS_TIME_ZONE = "Asia/Manila";

/** The calendar date (YYYY-MM-DD) of an instant in a time zone. */
export function isoDateIn(instant: Date | string, timeZone = BUSINESS_TIME_ZONE): string {
    return new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date(instant));
}

/** Whole days from `from` to `to`, both ISO dates (YYYY-MM-DD). */
export function daysBetween(from: string, to: string): number {
    return Math.round((Date.parse(to) - Date.parse(from)) / DAY_MS);
}

export function addDays(iso: string, days: number): string {
    return new Date(Date.parse(iso) + days * DAY_MS).toISOString().slice(0, 10);
}

/** Dated work that is still open, soonest first. */
export function openDeadlines(tasks: DashboardTask[], milestones: DashboardMilestone[]): Deadline[] {
    const deadlines: Deadline[] = [];
    for (const t of tasks) {
        if (t.stage !== "done" && t.due_date)
            deadlines.push({ kind: "task", id: t.id, project_id: t.project_id, title: t.title, due_date: t.due_date });
    }
    for (const m of milestones) {
        if (!m.completed && m.due_date)
            deadlines.push({ kind: "milestone", id: m.id, project_id: m.project_id, title: m.title, due_date: m.due_date });
    }
    return deadlines.sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function partitionDeadlines(deadlines: Deadline[], today: string, horizonDays: number) {
    const horizon = addDays(today, horizonDays);
    return {
        overdue: deadlines.filter((d) => d.due_date < today),
        upcoming: deadlines.filter((d) => d.due_date >= today && d.due_date <= horizon),
    };
}

export function projectLoads(projectIds: string[], tasks: DashboardTask[], milestones: DashboardMilestone[], today: string): Map<string, ProjectLoad> {
    const loads = new Map<string, ProjectLoad>(projectIds.map((id) => [id, {
            tasksTotal: 0,
            stages: { to_do: 0, in_progress: 0, review: 0, done: 0 },
            inReview: [],
            overdue: 0,
            nextDeadline: null,
        }]));
    for (const t of tasks) {
        const load = loads.get(t.project_id);
        if (!load)
            continue;
        load.tasksTotal += 1;
        load.stages[t.stage === "backlog" ? "to_do" : t.stage] += 1;
        if (t.stage === "review")
            load.inReview.push(t);
    }
    for (const d of openDeadlines(tasks, milestones)) {
        const load = loads.get(d.project_id);
        if (!load)
            continue;
        load.nextDeadline ??= d;
        if (d.due_date < today)
            load.overdue += 1;
    }
    return loads;
}

/** Most urgent first: most overdue, then most waiting for review, then whichever ends soonest. */
export function sortByAttention<P extends { id: string; end_date: string }>(projects: P[], loads: Map<string, ProjectLoad>): P[] {
    const overdue = (id: string) => loads.get(id)?.overdue ?? 0;
    const review = (id: string) => loads.get(id)?.inReview.length ?? 0;
    return [...projects].sort((a, b) => overdue(b.id) - overdue(a.id) ||
        review(b.id) - review(a.id) ||
        a.end_date.localeCompare(b.end_date));
}

/** Every active task in the portfolio, by board stage: the whole bolt. */
export function portfolioStages(loads: Iterable<ProjectLoad>): StageCounts & { total: number } {
    const sum = { to_do: 0, in_progress: 0, review: 0, done: 0, total: 0 };
    for (const load of loads) {
        sum.to_do += load.stages.to_do;
        sum.in_progress += load.stages.in_progress;
        sum.review += load.stages.review;
        sum.done += load.stages.done;
        sum.total += load.tasksTotal;
    }
    return sum;
}

/* Wording shared by every role's Overview. Dates are ISO calendar dates. */

export function plural(n: number, noun: string): string {
    return `${n} ${noun}${n === 1 ? "" : "s"}`;
}

export function formatDate(iso: string, options: Intl.DateTimeFormatOptions): string {
    return new Intl.DateTimeFormat("en-US", { ...options, timeZone: "UTC" }).format(new Date(`${iso}T00:00:00Z`));
}

/** "Today", "Tomorrow", else "Mon, Oct 6". */
export function relativeDay(iso: string, today: string): string {
    const days = daysBetween(today, iso);
    if (days === 0)
        return "Today";
    if (days === 1)
        return "Tomorrow";
    return formatDate(iso, { weekday: "short", month: "short", day: "numeric" });
}

/** "today", "tomorrow", else "Oct 6"; reads after "Due". */
export function duePhrase(iso: string, today: string): string {
    const days = daysBetween(today, iso);
    return days === 0 ? "today" : days === 1 ? "tomorrow" : formatDate(iso, { month: "short", day: "numeric" });
}

export function relativePast(iso: string, today: string): string {
    const days = daysBetween(iso, today);
    return days <= 0 ? "today" : `${days}d ago`;
}

/** Where `iso` falls between `start` and `end`, clamped to 0..1. */
export function spanShare(start: string, end: string, iso: string): number {
    const span = Math.max(daysBetween(start, end), 1);
    return Math.min(Math.max(daysBetween(start, iso) / span, 0), 1);
}

/** "Good morning" before noon, "Good afternoon" before six, then "Good evening", in Manila. */
export function greeting(instant: Date, timeZone = BUSINESS_TIME_ZONE): string {
    const hour = Number(new Intl.DateTimeFormat("en-US", { timeZone, hour: "numeric", hourCycle: "h23" }).format(instant));
    return hour < 12 ? "Good morning" : hour < 18 ? "Good afternoon" : "Good evening";
}

/** ISO-8601 week number of a calendar date (weeks start Monday; week 1 holds the first Thursday). */
export function isoWeek(iso: string): number {
    const d = new Date(`${iso}T00:00:00Z`);
    const thursday = new Date(d);
    thursday.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
    const yearStart = Date.UTC(thursday.getUTCFullYear(), 0, 1);
    return Math.floor((thursday.getTime() - yearStart) / DAY_MS / 7) + 1;
}

export type Pace = {
    /** Share of the planned span elapsed, 0..1. */
    time: number;
    /** Share of tasks accepted, 0..1. */
    work: number;
    state: "not_started" | "ended" | "behind" | "on_pace";
};

/**
 * A project's work against its own calendar. Behind means a quarter more of
 * the time is gone than of the work is accepted, the rule the PM cards used.
 */
export function projectPace(project: { start_date: string; end_date: string }, load: Pick<ProjectLoad, "tasksTotal" | "stages">, today: string): Pace {
    const time = spanShare(project.start_date, project.end_date, today);
    const work = load.tasksTotal > 0 ? load.stages.done / load.tasksTotal : 0;
    const state = today < project.start_date ? "not_started" : today > project.end_date ? "ended" : time - work > 0.25 ? "behind" : "on_pace";
    return { time, work, state };
}

/** Deadlines grouped by project, soonest first within each; projects ordered by their soonest. */
export function groupByProject(deadlines: Deadline[]): Deadline[][] {
    const groups = new Map<string, Deadline[]>();
    for (const d of [...deadlines].sort((a, b) => a.due_date.localeCompare(b.due_date)))
        groups.set(d.project_id, [...(groups.get(d.project_id) ?? []), d]);
    return [...groups.values()];
}

/**
 * How much an opening card should grow on each side of its slot [x0, x1] so
 * that, zoomed by `scale` around its own centre, it is `ratio` times its
 * resting width. It always grows evenly; where the edges of [min, max] leave
 * less room, it grows only as far as fits on both sides.
 */
export function centredGrowth(x0: number, x1: number, min: number, max: number, ratio: number, scale: number): number {
    const width = x1 - x0;
    const wanted = (width * (ratio / scale - 1)) / 2;
    const room = Math.min(x0 - min, max - x1);
    const fits = ((2 * room + width) / scale - width) / 2;
    return Math.max(0, Math.min(wanted, fits));
}

type FieldTask = { id: string; stage: string; due_date: string | null };

/** Field order: sent back first, then underway, then ready to start, then waiting on review. */
function fieldRank(task: FieldTask, sentBack: Set<string>) {
    if (task.stage === "in_progress")
        return sentBack.has(task.id) ? 0 : 1;
    if (task.stage === "to_do" || task.stage === "backlog")
        return 2;
    return 3;
}

/** A middleman's tasks in working order: rank, then soonest due (undated last). */
export function fieldOrder<T extends FieldTask>(tasks: T[], sentBack: Set<string>): T[] {
    return [...tasks].sort((a, b) => fieldRank(a, sentBack) - fieldRank(b, sentBack) ||
        (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

/** "today", "yesterday", "5 days ago", then the date itself: full words, never "5d". */
export function agoPhrase(iso: string, today: string): string {
    const days = daysBetween(iso, today);
    if (days <= 0)
        return "today";
    if (days === 1)
        return "yesterday";
    if (days < 30)
        return `${days} days ago`;
    return `on ${formatDate(iso, { month: "short", day: "numeric" })}`;
}

/** What an empty week says instead: the next date beyond it, the projects whose plan ran out while late, or nothing. */
export type QuietWeek =
    | { kind: "next"; deadline: Deadline }
    | { kind: "stalled"; projects: { project_id: string; late: number }[] }
    | { kind: "idle" };

export function quietWeek(overdue: Deadline[], later: Deadline | undefined): QuietWeek {
    if (later)
        return { kind: "next", deadline: later };
    if (overdue.length === 0)
        return { kind: "idle" };
    const late = new Map<string, number>();
    for (const d of overdue)
        late.set(d.project_id, (late.get(d.project_id) ?? 0) + 1);
    return { kind: "stalled", projects: [...late].map(([project_id, n]) => ({ project_id, late: n })).sort((a, b) => b.late - a.late) };
}
