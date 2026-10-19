import type { Milestone, Project, Task } from "../types/database";
import { addDays, daysBetween, formatDate, isoDateIn, plural } from "./dashboard.ts";

/**
 * Pure derivations behind the owner's Overview and the PM's Analytics page.
 * Every count is descriptive, what happened and what stands now, except
 * `forecast`, which projects an active project's recent pace forward. Dates are Manila calendar dates; timestamps become one through
 * `dateOf`. Relative imports keep this file runnable by `node --test`.
 */

export type AProject = Pick<Project, "id" | "title" | "pm_id" | "client_id" | "status" | "start_date" | "end_date" | "completed_at">;
export type ATask = Pick<Task, "id" | "project_id" | "title" | "stage" | "assigned_to" | "due_date" | "completed_at" | "updated_at">;
export type AMilestone = Pick<Milestone, "id" | "project_id" | "title" | "due_date" | "completed" | "completed_at">;
/** One logged stage change of a task (`task_moved` in the activity feed). */
export type TaskMove = { task_id: string; from: string; to: string; at: string };

/** The Manila calendar date of a timestamp. */
export const dateOf = (ts: string) => isoDateIn(ts);
const isActive = (p: Pick<AProject, "status">) => p.status !== "completed";
const shortDate = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

export type Overrun = { kind: "end" | "milestone"; days: number; milestone: AMilestone | null };

/**
 * How far an active project has run past its end date or its most overdue
 * open milestone; null when it has not. The larger overrun wins, the end date
 * on a tie. For an end-date overrun, `milestone` is the first one still open.
 */
export function overrun(project: AProject, milestones: AMilestone[], today: string): Overrun | null {
    if (!isActive(project))
        return null;
    const open = milestones
        .filter((m) => m.project_id === project.id && !m.completed)
        .sort((a, b) => a.due_date.localeCompare(b.due_date));
    const late = open.find((m) => m.due_date < today) ?? null;
    const milestoneDays = late ? daysBetween(late.due_date, today) : 0;
    const endDays = project.end_date < today ? daysBetween(project.end_date, today) : 0;
    if (milestoneDays === 0 && endDays === 0)
        return null;
    return endDays >= milestoneDays
        ? { kind: "end", days: endDays, milestone: open[0] ?? null }
        : { kind: "milestone", days: milestoneDays, milestone: late };
}

/** "Milestone “X” was due Oct 9", or "Passed its end date of Oct 10; “X” is still open". */
export function overrunFact(o: Overrun, project: AProject): string {
    if (o.kind === "milestone" && o.milestone)
        return `Milestone “${o.milestone.title}” was due ${shortDate(o.milestone.due_date)}`;
    const open = o.milestone ? `; “${o.milestone.title}” is still open` : "";
    return `Passed its end date of ${shortDate(project.end_date)}${open}`;
}

/** Active projects that are behind, most late first. */
export function behindSchedule(projects: AProject[], milestones: AMilestone[], today: string): (Overrun & { project: AProject })[] {
    return projects
        .flatMap((project) => {
            const o = overrun(project, milestones, today);
            return o ? [{ ...o, project }] : [];
        })
        .sort((a, b) => b.days - a.days);
}

export type ProjectResult = { kind: "late" | "early" | "on_day" | "past_end" | "milestone_late" | "on_schedule"; days: number };

/** How a delivered project ended against its plan, or how an active one stands today. */
export function projectResult(project: AProject, milestones: AMilestone[], today: string): ProjectResult {
    if (!isActive(project)) {
        const late = project.completed_at ? daysBetween(project.end_date, dateOf(project.completed_at)) : 0;
        return { kind: late > 0 ? "late" : late < 0 ? "early" : "on_day", days: Math.abs(late) };
    }
    const o = overrun(project, milestones, today);
    if (!o)
        return { kind: "on_schedule", days: 0 };
    return { kind: o.kind === "end" ? "past_end" : "milestone_late", days: o.days };
}

export function resultPhrase(r: ProjectResult): string {
    switch (r.kind) {
        case "late": return `${plural(r.days, "day")} late`;
        case "early": return `${plural(r.days, "day")} early`;
        case "on_day": return "On the day";
        case "past_end": return `${plural(r.days, "day")} past end date`;
        case "milestone_late": return `Milestone ${plural(r.days, "day")} late`;
        case "on_schedule": return "On schedule";
    }
}

export function resultTone(r: ProjectResult): "good" | "neutral" | "bad" {
    if (r.kind === "early" || r.kind === "on_day")
        return "good";
    return r.kind === "on_schedule" ? "neutral" : "bad";
}

export type Delivery = { project: AProject; date: string; late: number };

/** Completed projects, oldest delivery first. `late` is days past the planned end; negative is early. */
export function deliveries(projects: AProject[]): Delivery[] {
    return projects
        .filter((p) => p.status === "completed" && p.completed_at)
        .map((project) => {
            const date = dateOf(project.completed_at!);
            return { project, date, late: daysBetween(project.end_date, date) };
        })
        .sort((a, b) => a.date.localeCompare(b.date));
}

export type DeliveryRecord = { delivered: number; onTime: number; avgLate: number | null };

/** On time means delivered on or before the planned end. The average covers the late ones only. */
export function deliveryRecord(ds: Delivery[]): DeliveryRecord {
    const late = ds.filter((d) => d.late > 0);
    return {
        delivered: ds.length,
        onTime: ds.length - late.length,
        avgLate: late.length > 0 ? Math.round(late.reduce((s, d) => s + d.late, 0) / late.length) : null,
    };
}

export function deliveryPhrase(late: number): string {
    if (late > 0)
        return `${plural(late, "day")} late`;
    return late < 0 ? `${plural(-late, "day")} early` : "on the day";
}

export type Month = { key: string; month: number; year: number };

/** The `count` calendar months ending with today's, oldest first. `key` is "YYYY-MM"; `month` is 0–11. */
export function lastMonths(today: string, count = 12): Month[] {
    const [y, m] = today.split("-").map(Number);
    return Array.from({ length: count }, (_, i) => {
        const d = new Date(Date.UTC(y, m - 1 - (count - 1 - i), 1));
        return { key: d.toISOString().slice(0, 7), month: d.getUTCMonth(), year: d.getUTCFullYear() };
    });
}

/** This year's inquiries: received, became projects, and not yet opened by this viewer. */
export function inquiryYear(rows: { id: string; status: string; created_at: string }[], viewedIds: Iterable<string>, year: string) {
    const seen = new Set(viewedIds);
    const mine = rows.filter((r) => dateOf(r.created_at).startsWith(year));
    return {
        received: mine.length,
        converted: mine.filter((r) => r.status === "converted").length,
        unopened: mine.filter((r) => !seen.has(r.id)).length,
    };
}

export type MilestoneRecord = { completed: number; onTime: number; overdue: number; ticks: ("on_time" | "late")[] };

/**
 * A completed milestone is on time when it was completed on or before its due
 * date; one with no recorded date counts as on time. Overdue counts open
 * milestones past their date. `ticks` follow due-date order.
 */
export function milestoneRecord(milestones: AMilestone[], today: string): MilestoneRecord {
    const done = milestones.filter((m) => m.completed).sort((a, b) => a.due_date.localeCompare(b.due_date));
    const ticks = done.map((m) => (!m.completed_at || dateOf(m.completed_at) <= m.due_date ? "on_time" as const : "late" as const));
    return {
        completed: done.length,
        onTime: ticks.filter((t) => t === "on_time").length,
        overdue: milestones.filter((m) => !m.completed && m.due_date < today).length,
        ticks,
    };
}

/** Late is open work past its due date; work in review waits on the PM, so it is never late (as in `lib/people-load.ts`). */
const isLate = (t: ATask, today: string) => t.stage !== "done" && t.stage !== "review" && t.due_date !== null && t.due_date < today;

export type OpenLoad = { open: number; late: number; review: number };

export function openLoad(tasks: ATask[], today: string): OpenLoad {
    const open = tasks.filter((t) => t.stage !== "done");
    return { open: open.length, late: open.filter((t) => isLate(t, today)).length, review: open.filter((t) => t.stage === "review").length };
}

export type Waiting = { task: ATask; since: string; days: number };

/** Tasks in review, oldest submission first. A submission dates from the task's latest move into review, else its last update. */
export function waitingForReview(tasks: ATask[], moves: TaskMove[], today: string): Waiting[] {
    const submitted = new Map<string, string>();
    for (const m of moves) {
        if (m.to === "review" && (submitted.get(m.task_id) ?? "") < m.at)
            submitted.set(m.task_id, m.at);
    }
    return tasks
        .filter((t) => t.stage === "review")
        .map((task) => {
            const since = submitted.get(task.id) ?? task.updated_at;
            return { task, since, days: Math.max(0, daysBetween(dateOf(since), today)) };
        })
        .sort((a, b) => a.since.localeCompare(b.since));
}

export type Forecast =
    | { kind: "no_tasks" | "all_accepted" | "too_early" }
    | { kind: "on_pace" | "late"; finish: string; days: number };

/** The weeks of recent pace a forecast goes by, and the fewest accepted tasks in them worth projecting from. */
const PACE_WEEKS = 4, PACE_MIN = 3;

/**
 * When an active project's open tasks should all be accepted if the pace of
 * its last four weeks holds, against its planned end. Every task counts the
 * same: tasks carry no size. `days` is how far past the end date it lands.
 */
export function forecast(project: AProject, tasks: ATask[], today: string): Forecast {
    if (tasks.length === 0)
        return { kind: "no_tasks" };
    const open = tasks.filter((t) => t.stage !== "done").length;
    if (open === 0)
        return { kind: "all_accepted" };
    const from = addDays(today, 1 - PACE_WEEKS * 7);
    const recent = tasks.filter((t) => t.stage === "done" && t.completed_at && dateOf(t.completed_at) >= from).length;
    if (recent < PACE_MIN)
        return { kind: "too_early" };
    const finish = addDays(today, Math.ceil((open * PACE_WEEKS * 7) / recent));
    const days = daysBetween(project.end_date, finish);
    return days > 0 ? { kind: "late", finish, days } : { kind: "on_pace", finish, days: 0 };
}

export function forecastPhrase(f: Forecast): string {
    switch (f.kind) {
        case "no_tasks": return "No tasks yet";
        case "all_accepted": return "All tasks accepted";
        case "too_early": return "Too early to tell";
        case "on_pace": return "On pace";
        case "late": return f.days < 14 ? `About ${plural(f.days, "day")} late` : `About ${Math.round(f.days / 7)} weeks late`;
    }
}

export type Person = { id: string; name: string; avatarUrl: string | null };
export type ProjectRow = {
    project: AProject;
    result: ProjectResult;
    milestones: { done: number; onTime: number; overdue: number };
    tasks: { done: number; total: number };
    /** Null once delivered. */
    forecast: Forecast | null;
};

/** One row per project: active ones newest start first, delivered ones newest delivery first. */
export function projectRows(projects: AProject[], milestones: AMilestone[], tasks: ATask[], today: string): { active: ProjectRow[]; delivered: ProjectRow[] } {
    const row = (project: AProject): ProjectRow => {
        const ms = milestoneRecord(milestones.filter((m) => m.project_id === project.id), today);
        const ts = tasks.filter((t) => t.project_id === project.id);
        return {
            project,
            result: projectResult(project, milestones, today),
            milestones: { done: ms.completed, onTime: ms.onTime, overdue: ms.overdue },
            tasks: { done: ts.filter((t) => t.stage === "done").length, total: ts.length },
            forecast: isActive(project) ? forecast(project, ts, today) : null,
        };
    };
    return {
        active: projects.filter(isActive).sort((a, b) => b.start_date.localeCompare(a.start_date)).map(row),
        delivered: projects
            .filter((p) => !isActive(p))
            .sort((a, b) => (b.completed_at ?? b.end_date).localeCompare(a.completed_at ?? a.end_date))
            .map(row),
    };
}

/** "today", "1 day", "5 days": how long something has waited. */
export const agePhrase = (days: number) => (days === 0 ? "today" : plural(days, "day"));
/** Waiting is quiet for a day, a warning from two, late from three. */
export const ageTone = (days: number): "late" | "warn" | "quiet" => (days >= 3 ? "late" : days >= 2 ? "warn" : "quiet");

/** Accounts for the owner's people line. The super admin is not one of the people it lists, so it is not counted. */
export function peopleCount(roles: string[]) {
    const n = (role: string) => roles.filter((r) => r === role).length;
    const pm = n("project_manager"), crew = n("middleman"), client = n("client");
    return { total: pm + crew + client, pm, crew, client };
}

/** Managers running at least one active project. */
export const managingCount = (projects: AProject[]) => new Set(projects.filter(isActive).map((p) => p.pm_id)).size;
