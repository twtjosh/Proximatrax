import type { Milestone, Project, Task } from "../types/database";
import { addDays, daysBetween, formatDate, isoDateIn, plural } from "./dashboard.ts";

/**
 * Pure derivations behind the owner's Overview and the PM's Analytics page.
 * Every count is descriptive: what happened and what stands now, never a
 * forecast. Dates are Manila calendar dates; timestamps become one through
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

export type TaskCounts = { ongoing: number; dueSoon: number; completed: number };

/** Ongoing is in progress or in review; due soon is open work due from today through `horizonDays - 1` days ahead. */
export function taskCounts(tasks: ATask[], today: string, horizonDays = 14): TaskCounts {
    const last = addDays(today, horizonDays - 1);
    return {
        ongoing: tasks.filter((t) => t.stage === "in_progress" || t.stage === "review").length,
        dueSoon: tasks.filter((t) => t.stage !== "done" && t.due_date !== null && t.due_date >= today && t.due_date <= last).length,
        completed: tasks.filter((t) => t.stage === "done").length,
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

/**
 * Mean days from a submission to the PM's answer (accepted or sent back), over
 * submissions made in the last `windowDays`, to one decimal. Submissions still
 * waiting are left out; null when none was answered.
 */
export function reviewTurnaround(moves: TaskMove[], today: string, windowDays = 90): number | null {
    const from = addDays(today, -(windowDays - 1));
    const sorted = [...moves].sort((a, b) => a.at.localeCompare(b.at));
    const waits: number[] = [];
    // ponytail: scans forward per submission (O(n²)); index moves by task if a PM's log grows past a few thousand.
    sorted.forEach((m, i) => {
        if (m.to !== "review" || dateOf(m.at) < from)
            return;
        const answer = sorted.slice(i + 1).find((n) => n.task_id === m.task_id && n.from === "review");
        if (answer)
            waits.push((Date.parse(answer.at) - Date.parse(m.at)) / 86_400_000);
    });
    return waits.length > 0 ? Math.round((waits.reduce((s, w) => s + w, 0) / waits.length) * 10) / 10 : null;
}

export type Person = { id: string; name: string; avatarUrl: string | null };
export type CrewRow = Person & OpenLoad & { finished: number; finishedOnTime: number; sentBack: number; submissions: number };

/**
 * Each person's record across `tasks`: open work, lateness, finished work
 * (on time when it has no due date or was completed by it), and how often
 * their submissions came back. Moves count for the task's current assignee.
 * People with no tasks are left out. Most late first, then busiest.
 */
export function crewRecord(people: Person[], tasks: ATask[], moves: TaskMove[], today: string): CrewRow[] {
    const assignee = new Map(tasks.map((t) => [t.id, t.assigned_to]));
    return people
        .map((p) => {
            const mine = tasks.filter((t) => t.assigned_to === p.id);
            const done = mine.filter((t) => t.stage === "done");
            const theirs = moves.filter((m) => assignee.get(m.task_id) === p.id);
            return {
                ...p,
                ...openLoad(mine, today),
                finished: done.length,
                finishedOnTime: done.filter((t) => !t.due_date || !t.completed_at || dateOf(t.completed_at) <= t.due_date).length,
                submissions: theirs.filter((m) => m.to === "review").length,
                sentBack: theirs.filter((m) => m.from === "review" && m.to === "in_progress").length,
            };
        })
        .filter((r) => r.open + r.finished > 0)
        .sort((a, b) => b.late - a.late || b.open - a.open || a.name.localeCompare(b.name));
}

export type ProjectRow = {
    project: AProject;
    result: ProjectResult;
    milestones: { done: number; onTime: number; overdue: number };
    tasks: { done: number; total: number };
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
