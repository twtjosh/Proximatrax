import { addDays, daysBetween, isoDateIn } from "./dashboard.ts";
import type { TaskStage } from "../types/enums";
import type { TaskMove } from "./analytics.ts";

/**
 * How work moves through a project manager's projects: how long a task sits
 * in each step, how much comes back from review, and what is sitting where
 * now. Descriptive only. Built from the `task_moved` log plus each task's
 * creation and completion stamps. Relative imports keep this runnable by
 * `node --test`.
 */

export type FlowTask = {
    id: string;
    project_id: string;
    title: string;
    stage: TaskStage;
    assigned_to: string | null;
    due_date: string | null;
    completed_at: string | null;
    created_at: string;
    updated_at: string;
};

/** The three steps a task waits in, then Accepted (3). Backlog and to-do are one step. */
export const STEPS = ["To do", "In progress", "In review"] as const;
export const stepOf = (stage: string): number => (stage === "in_progress" ? 1 : stage === "review" ? 2 : stage === "done" ? 3 : 0);

const DAY_MS = 86_400_000;
const r1 = (n: number) => Math.round(n * 10) / 10;
// ponytail: unbounded memo of timestamp → Manila date; fine for one PM's log, scope it per call if logs reach ~100k moves.
const days = new Map<string, string>();
const dayOf = (ts: string) => {
    let d = days.get(ts);
    if (!d) days.set(ts, (d = isoDateIn(ts)));
    return d;
};
const inRange = (ts: string, from: string, to: string) => {
    const d = dayOf(ts);
    return d >= from && d <= to;
};

/** One stay in a step. `start` is null when the task entered it before moves were logged; `end` is null while it is still there. */
export type Visit = { task: string; step: number; start: string | null; end: string | null };

function movesByTask(moves: TaskMove[]): Map<string, TaskMove[]> {
    const by = new Map<string, TaskMove[]>();
    for (const m of moves) {
        const list = by.get(m.task_id);
        if (list) list.push(m);
        else by.set(m.task_id, [m]);
    }
    for (const list of by.values()) list.sort((a, b) => a.at.localeCompare(b.at));
    return by;
}

/**
 * Every stay of every task in a step, from its moves. A task starts in the
 * step its first move left (To do when it has no moves), timed from its
 * creation only when that step is To do. Moves inside one step are ignored.
 */
export function visits(tasks: FlowTask[], moves: TaskMove[]): Visit[] {
    const by = movesByTask(moves);
    const out: Visit[] = [];
    for (const t of tasks) {
        const ms = by.get(t.id) ?? [];
        let step = stepOf(ms[0]?.from ?? t.stage);
        let start: string | null = step === 0 ? t.created_at : null;
        for (const m of ms) {
            const next = stepOf(m.to);
            if (next === step) continue;
            if (step < 3) out.push({ task: t.id, step, start, end: m.at });
            step = next;
            start = m.at;
        }
        if (step < 3) out.push({ task: t.id, step, start, end: null });
    }
    return out;
}

export function median(xs: number[]): number | null {
    if (xs.length === 0) return null;
    const s = [...xs].sort((a, b) => a - b), mid = s.length >> 1;
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
}

/** Typical (median) days spent in each step, over stays that ended between `from` and `to` (Manila dates). Null for a step with none. */
export function stepMedians(vs: Visit[], from: string, to: string): (number | null)[] {
    return [0, 1, 2].map((step) => {
        const ds = vs.filter((v) => v.step === step && v.start && v.end && inRange(v.end, from, to)).map((v) => (Date.parse(v.end!) - Date.parse(v.start!)) / DAY_MS);
        const m = median(ds);
        return m === null ? null : r1(m);
    });
}

/** The sum of the steps that have a value; null when none has. */
export function journeyDays(steps: (number | null)[]): number | null {
    const known = steps.filter((s): s is number => s !== null);
    return known.length ? r1(known.reduce((a, b) => a + b, 0)) : null;
}

export type OpenTask = { task: FlowTask; step: number; days: number };

/**
 * Open tasks by the step they are in now, longest wait first. The wait counts
 * from the latest move into that step, else from creation (To do) or the
 * last update.
 */
export function openNow(tasks: FlowTask[], moves: TaskMove[], today: string): OpenTask[][] {
    const by = movesByTask(moves);
    const out: OpenTask[][] = [[], [], []];
    for (const t of tasks) {
        const step = stepOf(t.stage);
        if (step > 2) continue;
        const entered = [...(by.get(t.id) ?? [])].reverse().find((m) => stepOf(m.to) === step && stepOf(m.from) !== step)?.at;
        const since = entered ?? (step === 0 ? t.created_at : t.updated_at);
        out[step].push({ task: t, step, days: Math.max(0, daysBetween(dayOf(since), today)) });
    }
    for (const list of out) list.sort((a, b) => b.days - a.days);
    return out;
}

/** Accepted within the dates: done, with a completion stamp in range. */
export const acceptedIn = (tasks: FlowTask[], from: string, to: string) => tasks.filter((t) => t.stage === "done" && t.completed_at && inRange(t.completed_at, from, to));
/** On time means no due date, or completed on or before it. */
const onTime = (t: FlowTask) => !t.due_date || dayOf(t.completed_at!) <= t.due_date;
const isSendBack = (m: TaskMove) => m.from === "review" && m.to === "in_progress";

/** The Monday-start weeks covering the last `count` weeks, the current one last. */
export function weekStarts(today: string, count: number): string[] {
    const dow = new Date(`${today}T00:00:00Z`).getUTCDay();
    const monday = addDays(today, -((dow + 6) % 7));
    return Array.from({ length: count }, (_, i) => addDays(monday, -7 * (count - 1 - i)));
}

/** Mean days from each send-back in range to that task's next submission; null when none came back yet. */
export function reworkDays(moves: TaskMove[], from: string, to: string): number | null {
    const by = movesByTask(moves);
    const waits: number[] = [];
    for (const list of by.values()) {
        list.forEach((m, i) => {
            if (!isSendBack(m) || !inRange(m.at, from, to)) return;
            const again = list.slice(i + 1).find((n) => n.to === "review");
            if (again) waits.push((Date.parse(again.at) - Date.parse(m.at)) / DAY_MS);
        });
    }
    return waits.length ? r1(waits.reduce((a, b) => a + b, 0) / waits.length) : null;
}

export type FlowPeriod = {
    steps: (number | null)[];
    accepted: number;
    onTime: number;
    submitted: number;
    sentBack: number;
};

function period(tasks: FlowTask[], moves: TaskMove[], vs: Visit[], from: string, to: string): FlowPeriod {
    const acc = acceptedIn(tasks, from, to);
    return {
        steps: stepMedians(vs, from, to),
        accepted: acc.length,
        onTime: acc.filter(onTime).length,
        submitted: moves.filter((m) => m.to === "review" && inRange(m.at, from, to)).length,
        sentBack: moves.filter((m) => isSendBack(m) && inRange(m.at, from, to)).length,
    };
}

export type FlowSummary = {
    now: FlowPeriod;
    before: FlowPeriod;
    reworkDays: number | null;
    weeks: string[];
    weekly: {
        accepted: number[];
        acceptedBefore: number[];
        review: (number | null)[];
        sentBack: number[];
        onTime: (number | null)[];
        journey: (number | null)[];
    };
    open: OpenTask[][];
};

/**
 * Everything the Flow page shows for one scope of tasks over the last
 * `days` days, against the `days` before. Weekly series cover the weeks
 * that overlap the period; `acceptedBefore` is the same weeks one period earlier.
 */
export function flowSummary(tasks: FlowTask[], moves: TaskMove[], today: string, days: number): FlowSummary {
    const vs = visits(tasks, moves);
    const from = addDays(today, -(days - 1));
    const weeks = weekStarts(today, Math.ceil(days / 7));
    const shift = weeks.length * 7;
    const week = (ws: string) => period(tasks, moves, vs, ws, addDays(ws, 6));
    const perWeek = weeks.map(week);
    return {
        now: period(tasks, moves, vs, from, today),
        before: period(tasks, moves, vs, addDays(from, -days), addDays(from, -1)),
        reworkDays: reworkDays(moves, from, today),
        weeks,
        weekly: {
            accepted: perWeek.map((w) => w.accepted),
            acceptedBefore: weeks.map((ws) => acceptedIn(tasks, addDays(ws, -shift), addDays(ws, 6 - shift)).length),
            review: perWeek.map((w) => w.steps[2]),
            sentBack: perWeek.map((w) => w.sentBack),
            onTime: perWeek.map((w) => (w.accepted ? w.onTime / w.accepted : null)),
            journey: perWeek.map((w) => journeyDays(w.steps)),
        },
        open: openNow(tasks, moves, today),
    };
}

/** The tasks and moves of one project or one person's current work; moves follow their task. */
export function scopeFlow(tasks: FlowTask[], moves: TaskMove[], keep: (t: FlowTask) => boolean): { tasks: FlowTask[]; moves: TaskMove[] } {
    const kept = tasks.filter(keep);
    const ids = new Set(kept.map((t) => t.id));
    return { tasks: kept, moves: moves.filter((m) => ids.has(m.task_id)) };
}

/** Days per task in progress for one person over the period: the typical stay in step 1. */
export function daysPerTask(tasks: FlowTask[], moves: TaskMove[], today: string, days: number): number | null {
    return stepMedians(visits(tasks, moves), addDays(today, -(days - 1)), today)[1];
}
