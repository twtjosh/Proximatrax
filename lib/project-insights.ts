import { addDays, daysBetween } from "./dashboard.ts";

/**
 * Numbers behind the PM's project Overview, from real task data only.
 * Pure, so `node --test` runs it.
 */

type InsightTask = { stage: string; updated_at: string; client_visible_at: string | null };

/** The day a task was accepted: when the client was shown it, else its last change. */
const acceptedOn = (t: InsightTask) => (t.client_visible_at ?? t.updated_at).slice(0, 10);

export type Forecast = { date: string; slip: number } | null;

/**
 * When handover lands at the pace work has been accepted so far. Null until
 * something has been accepted, or before the project starts: there is no pace yet.
 */
export function forecastHandover(start: string, end: string, tasks: InsightTask[], today: string): Forecast {
    const total = tasks.length;
    const accepted = tasks.filter((t) => t.stage === "done").length;
    if (total === 0 || today <= start)
        return null;
    if (accepted === total) {
        const last = tasks.map(acceptedOn).sort().at(-1)!;
        return { date: last, slip: daysBetween(end, last) };
    }
    if (accepted === 0)
        return null;
    const perDay = accepted / Math.max(daysBetween(start, today), 1);
    const date = addDays(today, Math.ceil((total - accepted) / perDay));
    return { date, slip: daysBetween(end, date) };
}

export type ProgressPoint = { date: string; accepted: number; planned: number };

/**
 * Accepted work week by week against the straight line from nothing at the
 * start to everything at handover. Stops at today (or handover, if past).
 */
export function progressSeries(start: string, end: string, tasks: InsightTask[], today: string): ProgressPoint[] {
    const total = tasks.length;
    if (total === 0 || today < start)
        return [];
    const span = Math.max(daysBetween(start, end), 1);
    const stop = today < end ? today : end;
    const done = tasks.filter((t) => t.stage === "done").map(acceptedOn).sort();
    const points: ProgressPoint[] = [];
    for (let d = start; ; d = addDays(d, 7)) {
        const at = d > stop ? stop : d;
        points.push({
            date: at,
            accepted: done.filter((x) => x <= at).length,
            planned: Math.round((total * Math.min(daysBetween(start, at), span)) / span),
        });
        if (at === stop)
            break;
    }
    return points;
}

/** In-progress work grouped by who has it, busiest first; unassigned last. */
export function onSiteNow<T extends { stage: string; assigned_to: string | null }>(tasks: T[]): { person: string | null; tasks: T[] }[] {
    const groups = new Map<string | null, T[]>();
    for (const t of tasks) {
        if (t.stage !== "in_progress")
            continue;
        groups.set(t.assigned_to, [...(groups.get(t.assigned_to) ?? []), t]);
    }
    return [...groups].map(([person, list]) => ({ person, tasks: list }))
        .sort((a, b) => Number(a.person === null) - Number(b.person === null) || b.tasks.length - a.tasks.length);
}
