import { addDays, daysBetween, formatDate } from "./dashboard.ts";

/**
 * The geometry behind the Schedule timeline: where each milestone's bar runs,
 * the visible date range, and converting between dates and positions (snapped
 * to whole days). Pure, so `node --test` can run it.
 */

/** Days of air either side of the project window. */
const PAD_DAYS = 3;

/** Each bar runs from the previous milestone's due date (or the project start) to its own. */
export function milestoneSpans(milestones: { id: string; due_date: string }[], projectStart: string): { id: string; start: string; end: string }[] {
    const sorted = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date));
    return sorted.map((m, i) => {
        const prev = i === 0 ? projectStart : sorted[i - 1].due_date;
        return { id: m.id, start: prev <= m.due_date ? prev : m.due_date, end: m.due_date };
    });
}

export type Range = { from: string; to: string };

/** The visible window: the project and every due date, padded a few days. */
export function timelineRange(start: string, end: string, milestones: { due_date: string }[]): Range {
    const dates = [start, end, ...milestones.map((m) => m.due_date)].sort();
    return { from: addDays(dates[0], -PAD_DAYS), to: addDays(dates[dates.length - 1], PAD_DAYS) };
}

/** 0 at the window's first day, 1 at its last. */
export function dateToFraction(date: string, range: Range): number {
    return daysBetween(range.from, date) / Math.max(daysBetween(range.from, range.to), 1);
}

/** The whole day nearest a position, kept inside the window. */
export function fractionToDate(fraction: number, range: Range): string {
    const span = Math.max(daysBetween(range.from, range.to), 1);
    return addDays(range.from, Math.min(Math.max(Math.round(fraction * span), 0), span));
}

/** "+2d", "−3d", or nothing when unchanged. */
export function shiftLabel(original: string, next: string): string {
    const d = daysBetween(original, next);
    return d === 0 ? "" : d > 0 ? `+${d}d` : `−${-d}d`;
}

/** The first of each month inside the window, for the grid. */
export function monthTicks(range: Range): { date: string; label: string; fraction: number }[] {
    const ticks: { date: string; label: string; fraction: number }[] = [];
    let y = Number(range.from.slice(0, 4));
    let m = Number(range.from.slice(5, 7));
    for (;;) {
        m += 1;
        if (m > 12) {
            m = 1;
            y += 1;
        }
        const date = `${y}-${String(m).padStart(2, "0")}-01`;
        if (date > range.to)
            break;
        ticks.push({ date, label: formatDate(date, { month: "short" }), fraction: dateToFraction(date, range) });
    }
    return ticks;
}
