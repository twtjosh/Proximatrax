import type { Milestone, Project, Task } from "../types/database";
import { daysBetween, formatDate, isoDateIn, plural } from "./dashboard.ts";

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
