import { addDays, formatDate, isoDateIn } from "./dashboard.ts";
import { HEALTH, isHealth, logKind, type Health, type LogKind, type LogRow } from "./project-log.ts";

/**
 * A project's timeline: its life cut into days, weeks or months, and what
 * happened in each. Days and weeks count from the project's start; months are
 * calendar months.
 * The range runs past the due date when work did, so an overrun shows as
 * periods beyond the plan. Pure, so `node --test` runs it.
 */

export type Unit = "day" | "week" | "month";
export type TimelineProject = { id: string; title: string; client: string; start: string; end: string; completedAt: string | null; active: boolean };
export type TimelineMilestone = { project_id: string; title: string; due_date: string; completed_at: string | null };
export type TimelineTask = { id: string; project_id: string; title: string; stage: string; assigned_to: string | null; due_date: string | null; created_at: string };
export type TimelineMove = { task_id: string; from: string; to: string; at: string };
export type TimelineEntry = LogRow & { project_id: string };
export type TimelinePerson = { name: string; role: string; avatarUrl: string | null };
export type TimelineData = {
    projects: TimelineProject[];
    milestones: TimelineMilestone[];
    log: TimelineEntry[];
    /** Everyone who appears in the log, by id; role is already the title to show (Foreman, Project manager…). */
    people: Record<string, TimelinePerson>;
};

export type Period = {
    index: number;
    /** Inclusive ISO dates. */
    from: string;
    to: string;
    /** "Day 4", "Week 3" or "Aug 2026". */
    label: string;
    /** "Jul 10 – 16", or "Mon, Jul 13" for a day. */
    range: string;
    /** Starts after the planned due date. */
    beyond: boolean;
    /** Starts after today. */
    upcoming: boolean;
    /** Contains today. */
    current: boolean;
};

export type Stage = "to_do" | "in_progress" | "review" | "done";
export type PeriodStats = {
    activities: number;
    /** Accepted during the period. */
    accepted: number;
    /** Where the project's tasks stood at the end of the period (or today). */
    open: Record<Exclude<Stage, "done">, number>;
    /** Open at the end of the period and already past their due date. */
    overdue: number;
    /** Due inside the period. */
    due: number;
    kinds: LogKind[];
};

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/** "Jul 10 – 16", "Jul 31 – Aug 6", and the year when the range crosses one. */
export function rangeLabel(from: string, to: string): string {
    if (from === to) return short(from);
    if (from.slice(0, 4) !== to.slice(0, 4)) return `${formatDate(from, { month: "short", day: "numeric", year: "numeric" })} – ${formatDate(to, { month: "short", day: "numeric", year: "numeric" })}`;
    return from.slice(0, 7) === to.slice(0, 7) ? `${short(from)} – ${Number(to.slice(8))}` : `${short(from)} – ${short(to)}`;
}

/** First and last day the timeline covers: the plan, stretched to any work outside it. */
export function timelineSpan(project: TimelineProject, log: TimelineEntry[], today: string): { from: string; to: string } {
    let from = project.start, to = project.end;
    const last = project.completedAt ? isoDateIn(project.completedAt) : project.active ? today : project.end;
    if (last > to) to = last;
    for (const e of log) {
        const d = isoDateIn(e.created_at);
        if (d < from) from = d;
        if (d > to) to = d;
    }
    return { from, to };
}

export function buildPeriods(span: { from: string; to: string }, due: string, unit: Unit, today: string): Period[] {
    const out: Period[] = [];
    let from = span.from;
    while (from <= span.to) {
        let to: string;
        if (unit === "day") to = from;
        else if (unit === "week") to = addDays(from, 6);
        else {
            const [y, m] = from.split("-").map(Number);
            to = addDays(`${m === 12 ? y + 1 : y}-${String(m === 12 ? 1 : m + 1).padStart(2, "0")}-01`, -1);
        }
        if (to > span.to) to = span.to;
        const label = unit === "day" ? `Day ${out.length + 1}` : unit === "week" ? `Week ${out.length + 1}` : formatDate(from, { month: "short", year: "numeric" });
        const range = unit === "day" ? formatDate(from, { weekday: "short", month: "short", day: "numeric" }) : rangeLabel(from, to);
        out.push({ index: out.length, from, to, label, range, beyond: from > due, upcoming: from > today, current: from <= today && today <= to });
        from = addDays(to, 1);
    }
    return out;
}

export const periodOf = (periods: Period[], date: string) => periods.findIndex((p) => p.from <= date && date <= p.to);

/** Each task's stage at the end of `day`, from its logged moves. A task with no moves before then sits where its first move took it from; one never moved is where it is now. */
export function stageOn(task: TimelineTask, moves: TimelineMove[], day: string): Stage | null {
    if (isoDateIn(task.created_at) > day) return null;
    let stage: string | null = null;
    for (const m of moves) {
        if (isoDateIn(m.at) > day) {
            stage ??= m.from;
            break;
        }
        stage = m.to;
    }
    const s = stage ?? task.stage;
    return s === "backlog" ? "to_do" : (s as Stage);
}

/** What one period holds. `moves` are grouped by task and oldest first. */
export function periodStats(period: Period, tasks: TimelineTask[], movesByTask: Map<string, TimelineMove[]>, log: TimelineEntry[], today: string): PeriodStats {
    const inside = log.filter((e) => {
        const d = isoDateIn(e.created_at);
        return period.from <= d && d <= period.to;
    });
    const kinds = [...new Set(inside.map(logKind))];
    const accepted = inside.filter((e) => e.action_type === "task_moved" && e.details?.to === "done").length;
    const open = { to_do: 0, in_progress: 0, review: 0 };
    let overdue = 0, due = 0;
    const end = period.to < today ? period.to : today;
    for (const t of tasks) {
        if (t.due_date && period.from <= t.due_date && t.due_date <= period.to) due++;
        if (period.upcoming) continue;
        const s = stageOn(t, movesByTask.get(t.id) ?? [], end);
        if (!s || s === "done") continue;
        open[s]++;
        // Due on a finished day and still open by its end, or due before today.
        if (t.due_date && (end < today ? t.due_date <= end : t.due_date < end)) overdue++;
    }
    return { activities: inside.length, accepted, open, overdue, due, kinds };
}

export function groupMoves(moves: TimelineMove[]): Map<string, TimelineMove[]> {
    const map = new Map<string, TimelineMove[]>();
    for (const m of [...moves].sort((a, b) => a.at.localeCompare(b.at)))
        map.set(m.task_id, [...(map.get(m.task_id) ?? []), m]);
    return map;
}

export type PhaseMark = { title: string; state: "delivered" | "due" | "missed"; text: string };
export type PeriodMarks = { phases: PhaseMark[]; health: { health: Health; label: string; note: string } | null };

/**
 * What a period holds that its counts don't: the phases delivered, due or
 * missed in it, and the PM's last status update. A phase is missed in the
 * period of its due date once that period has passed without it delivered on
 * time. `rows` are the period's log rows, oldest first.
 */
export function periodMarks(period: Period, milestones: TimelineMilestone[], rows: TimelineEntry[], today: string): PeriodMarks {
    const inside = (d: string) => period.from <= d && d <= period.to;
    const phases: PhaseMark[] = [];
    for (const m of milestones) {
        const done = m.completed_at ? isoDateIn(m.completed_at) : null;
        if (done && inside(done)) {
            const late = Math.round((Date.parse(done) - Date.parse(m.due_date)) / 86_400_000);
            phases.push({ title: m.title, state: "delivered", text: `${m.title} delivered ${short(done)} · ${late > 0 ? `${late} day${late === 1 ? "" : "s"} late` : "on time"}` });
        }
        else if (inside(m.due_date)) {
            const missed = period.to < today && (!done || done > m.due_date);
            phases.push({ title: m.title, state: missed ? "missed" : "due", text: missed ? `${m.title} was due ${short(m.due_date)} · ${done ? `delivered ${short(done)}` : "not delivered yet"}` : `${m.title} due ${short(m.due_date)}` });
        }
    }
    let health: PeriodMarks["health"] = null;
    for (const r of rows) {
        const h = r.details?.health;
        if (r.action_type === "project_update" && isHealth(h))
            health = { health: h, label: HEALTH[h].label, note: String(r.details?.note ?? "").trim() };
    }
    return { phases, health };
}
