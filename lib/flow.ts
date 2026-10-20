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
    milestone_id: string | null;
    title: string;
    stage: TaskStage;
    assigned_to: string | null;
    due_date: string | null;
    completed_at: string | null;
    /** When work is planned to begin (a date). */
    start_date: string | null;
    created_at: string;
    updated_at: string;
};

/** A project phase (milestone). Phases run in due-date order. */
export type FlowPhase = { id: string; project_id: string; title: string; due_date: string };

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

/** What a To do task still waits on before it can start: an earlier phase, or its planned start date. */
export type Later = { phase: FlowPhase | null; date: string | null };
/** When a task could first be started (`at`), and why then. `later` is set while it still can't. */
export type Readiness = { at: string; why: string; later: Later | null };

/** The start of a Manila calendar date, as an instant. */
const startOfDay = (date: string) => `${date}T00:00:00+08:00`;

/**
 * When each task could first be started: the latest of its creation, its
 * planned start, and the acceptance of the last task in the phases before its
 * own. A task is `later` while an earlier phase still has open tasks (the same
 * rule the board uses to block it) or its start date has not come.
 */
export function readiness(tasks: FlowTask[], phases: FlowPhase[], today: string): Map<string, Readiness> {
    const linked = new Map<string, FlowTask[]>();
    for (const t of tasks) {
        if (!t.milestone_id) continue;
        const list = linked.get(t.milestone_id);
        if (list) list.push(t);
        else linked.set(t.milestone_id, [t]);
    }
    const state = new Map(phases.map((p) => {
        const ts = linked.get(p.id) ?? [];
        const last = ts.reduce<string | null>((a, t) => (t.completed_at && (!a || Date.parse(t.completed_at) > Date.parse(a)) ? t.completed_at : a), null);
        return [p.id, { open: ts.some((t) => t.stage !== "done"), last }];
    }));
    const byProject = new Map<string, FlowPhase[]>();
    for (const p of [...phases].sort((a, b) => a.due_date.localeCompare(b.due_date))) {
        const list = byProject.get(p.project_id);
        if (list) list.push(p);
        else byProject.set(p.project_id, [p]);
    }
    const out = new Map<string, Readiness>();
    for (const t of tasks) {
        let at = t.created_at, why = "Created", phase: FlowPhase | null = null;
        const bump = (ts: string, reason: string) => {
            if (Date.parse(ts) > Date.parse(at)) [at, why] = [ts, reason];
        };
        const own = t.milestone_id ? byProject.get(t.project_id) ?? [] : [];
        for (const p of own.slice(0, Math.max(0, own.findIndex((q) => q.id === t.milestone_id)))) {
            const s = state.get(p.id)!;
            if (s.open) phase ??= p;
            else if (s.last) bump(s.last, `${p.title} finished`);
        }
        if (t.start_date) bump(startOfDay(t.start_date), "Planned start");
        const date = t.start_date && t.start_date > today ? t.start_date : null;
        out.set(t.id, { at, why, later: phase || date ? { phase, date } : null });
    }
    return out;
}

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
 * step its first move left (To do when it has no moves), timed from when it
 * was ready (else its creation) only when that step is To do. Moves inside
 * one step are ignored.
 */
export function visits(tasks: FlowTask[], moves: TaskMove[], ready?: Map<string, Readiness>): Visit[] {
    const by = movesByTask(moves);
    const out: Visit[] = [];
    for (const t of tasks) {
        const ms = by.get(t.id) ?? [];
        let step = stepOf(ms[0]?.from ?? t.stage);
        let start: string | null = step === 0 ? ready?.get(t.id)?.at ?? t.created_at : null;
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

/** Typical (median) days spent in each step, over stays that ended between `from` and `to` (Manila dates). Null for a step with none. A stay that ended before its task was ready counts as 0. */
export function stepMedians(vs: Visit[], from: string, to: string): (number | null)[] {
    return [0, 1, 2].map((step) => {
        const ds = vs.filter((v) => v.step === step && v.start && v.end && inRange(v.end, from, to)).map((v) => Math.max(0, Date.parse(v.end!) - Date.parse(v.start!)) / DAY_MS);
        const m = median(ds);
        return m === null ? null : r1(m);
    });
}

/** The sum of the steps that have a value; null when none has. */
export function journeyDays(steps: (number | null)[]): number | null {
    const known = steps.filter((s): s is number => s !== null);
    return known.length ? r1(known.reduce((a, b) => a + b, 0)) : null;
}

/** A task open now. `since` is when its wait began and `why` names that moment; `later` To do tasks can't start yet and wait 0 days. */
export type OpenTask = { task: FlowTask; step: number; days: number; since: string; why: string; later: Later | null };

/** Later tasks in the order they open: start dates first, soonest first, then those behind a phase, by phase. */
const laterKey = (l: Later) => (l.phase ? `~${l.phase.due_date}${l.phase.id}` : l.date!);

/**
 * Open tasks by the step they are in now, longest wait first, with To do's
 * later tasks after the rest. The wait counts from the latest move into that
 * step, else from when it was ready (To do) or the last update.
 */
export function openNow(tasks: FlowTask[], moves: TaskMove[], today: string, ready?: Map<string, Readiness>): OpenTask[][] {
    const by = movesByTask(moves);
    const out: OpenTask[][] = [[], [], []];
    for (const t of tasks) {
        const step = stepOf(t.stage);
        if (step > 2) continue;
        const entered = [...(by.get(t.id) ?? [])].reverse().find((m) => stepOf(m.to) === step && stepOf(m.from) !== step)?.at;
        const r = step === 0 ? ready?.get(t.id) : undefined, later = r?.later ?? null;
        const since = entered ?? (step === 0 ? r?.at ?? t.created_at : t.updated_at);
        const why = entered ? (step === 0 ? "Moved back to To do" : "Moved here") : r?.why ?? (step === 0 ? "Created" : "Last update");
        out[step].push({ task: t, step, days: later ? 0 : Math.max(0, daysBetween(dayOf(since), today)), since, why, later });
    }
    for (const list of out) list.sort((a, b) => (a.later && b.later ? (laterKey(a.later) < laterKey(b.later) ? -1 : laterKey(a.later) > laterKey(b.later) ? 1 : 0) : Number(!!a.later) - Number(!!b.later) || b.days - a.days));
    return out;
}

/** Accepted within the dates: done, with a completion stamp in range. */
export const acceptedIn = (tasks: FlowTask[], from: string, to: string) => tasks.filter((t) => t.stage === "done" && t.completed_at && inRange(t.completed_at, from, to));
/** Completed on or before its due date. Only tasks with a due date can be on time or late. */
const onTime = (t: FlowTask) => !!t.due_date && dayOf(t.completed_at!) <= t.due_date;
const isSendBack = (m: TaskMove) => m.from === "review" && m.to === "in_progress";

/** The first days of the last `count` seven-day weeks, oldest first; the last week ends today. */
export function weekStarts(today: string, count: number): string[] {
    return Array.from({ length: count }, (_, i) => addDays(today, 1 - 7 * (count - i)));
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
    /** Accepted tasks that had a due date: what on time is out of. */
    dated: number;
    onTime: number;
    /** Tasks created. */
    added: number;
    submitted: number;
    sentBack: number;
};

function period(tasks: FlowTask[], moves: TaskMove[], vs: Visit[], from: string, to: string): FlowPeriod {
    const acc = acceptedIn(tasks, from, to);
    return {
        steps: stepMedians(vs, from, to),
        accepted: acc.length,
        dated: acc.filter((t) => t.due_date).length,
        onTime: acc.filter(onTime).length,
        added: tasks.filter((t) => inRange(t.created_at, from, to)).length,
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
        added: number[];
    };
    open: OpenTask[][];
};

/**
 * Everything the Flow page shows for one scope of tasks over the last
 * `count` weeks, against the same span before. The weekly series split the
 * period exactly, so they add up to its totals. Work out `ready` from every
 * task, not just the scope's: a phase opens when all its tasks are accepted.
 */
export function flowSummary(tasks: FlowTask[], moves: TaskMove[], today: string, count: number, ready?: Map<string, Readiness>): FlowSummary {
    const vs = visits(tasks, moves, ready);
    const days = count * 7;
    const from = addDays(today, -(days - 1));
    const weeks = weekStarts(today, count);
    const week = (ws: string) => period(tasks, moves, vs, ws, addDays(ws, 6));
    const perWeek = weeks.map(week);
    return {
        now: period(tasks, moves, vs, from, today),
        before: period(tasks, moves, vs, addDays(from, -days), addDays(from, -1)),
        reworkDays: reworkDays(moves, from, today),
        weeks,
        weekly: {
            accepted: perWeek.map((w) => w.accepted),
            added: perWeek.map((w) => w.added),
        },
        open: openNow(tasks, moves, today, ready),
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
