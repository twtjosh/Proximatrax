import { daysBetween, formatDate, isoDateIn, plural } from "./dashboard.ts";

/**
 * What the Analytics numbers mean, in words: exact percentages, each
 * project's pace (work accepted against time used) and the page's summary
 * lines. Pure, so `node --test` can run it.
 */

export type Ratio = { n: number; of: number; pct: number | null };

/** A share as a whole percentage that never claims 0% with progress made, or 100% before it is done. */
export function ratio(n: number, of: number): Ratio {
    if (of <= 0)
        return { n, of, pct: null };
    const exact = (n / of) * 100;
    const pct = n <= 0 ? 0 : n >= of ? 100 : Math.min(99, Math.max(1, Math.round(exact)));
    return { n, of, pct };
}

type PaceProject = { start_date: string; end_date: string; completed_at: string | null };
type PaceTask = { stage: string; due_date: string | null };

export type PaceState = "not_started" | "no_tasks" | "on_pace" | "behind" | "ahead" | "past_end" | "delivered_on_time" | "delivered_late";
export type Pace = {
    state: PaceState;
    /** Tasks accepted of all tasks. */
    work: Ratio;
    /** Days used of the planned days, start and handover both counted. */
    time: Ratio;
    /** Work % minus time %; negative is behind. Null when either is unknown. */
    gap: number | null;
    /** Open work past its due date (work in review waits on the PM, so it is not counted). */
    overdue: number;
    /** Days past the handover date, or delivered after it. */
    daysOver: number;
    start: string;
};

/** Within this many points, work and time count as in step. */
const IN_STEP = 10;

export function projectPace(project: PaceProject, tasks: PaceTask[], today: string): Pace {
    const planned = daysBetween(project.start_date, project.end_date) + 1;
    const done = tasks.filter((t) => t.stage === "done").length;
    const work = ratio(done, tasks.length);
    const overdue = tasks.filter((t) => t.stage !== "done" && t.stage !== "review" && t.due_date !== null && t.due_date < today).length;
    const base = { work, overdue, start: project.start_date };
    if (project.completed_at) {
        const daysOver = Math.max(0, daysBetween(project.end_date, isoDateIn(project.completed_at)));
        return { ...base, state: daysOver > 0 ? "delivered_late" : "delivered_on_time", time: ratio(planned, planned), gap: null, daysOver };
    }
    // Accepted work before the start date means it has started, just early.
    if (today < project.start_date)
        return done === 0
            ? { ...base, state: "not_started", time: ratio(0, planned), gap: null, daysOver: 0 }
            : { ...base, state: "ahead", time: ratio(0, planned), gap: work.pct ?? 0, daysOver: 0 };
    const used = Math.min(planned, daysBetween(project.start_date, today) + 1);
    const time = ratio(used, planned);
    const daysOver = Math.max(0, daysBetween(project.end_date, today));
    if (daysOver > 0)
        return { ...base, state: "past_end", time, gap: work.pct === null ? null : work.pct - 100, daysOver };
    if (work.pct === null)
        return { ...base, state: "no_tasks", time, gap: null, daysOver: 0 };
    const gap = work.pct - (time.pct ?? 0);
    return { ...base, state: gap < -IN_STEP ? "behind" : gap > IN_STEP ? "ahead" : "on_pace", time, gap, daysOver: 0 };
}

/** The short name of a pace, as the status pill shows it. */
export const PACE_LABEL: Record<PaceState, string> = {
    not_started: "Not started", no_tasks: "No tasks yet", on_pace: "On pace", behind: "Behind pace", ahead: "Ahead of pace",
    past_end: "Past handover date", delivered_on_time: "Delivered on time", delivered_late: "Delivered late",
};
export const PACE_TONE: Record<PaceState, "good" | "warn" | "bad" | "quiet"> = {
    not_started: "quiet", no_tasks: "quiet", on_pace: "good", behind: "warn", ahead: "good",
    past_end: "bad", delivered_on_time: "good", delivered_late: "bad",
};

/** What the work and time bars mean together, in one sentence. */
export function paceSentence(p: Pace): string {
    switch (p.state) {
        case "not_started": return `Starts ${formatDate(p.start, { month: "short", day: "numeric" })}.`;
        case "no_tasks": return "No tasks yet, so progress can't be measured.";
        case "delivered_on_time": return "Handed over on or before the planned date.";
        case "delivered_late": return `Handed over ${plural(p.daysOver, "day")} after the planned date.`;
        case "past_end": return `${plural(p.daysOver, "day")} past its handover date with ${p.work.pct}% of the work accepted.`;
        case "behind": return `${p.work.pct}% of the work is accepted with ${p.time.pct}% of the time used: ${-(p.gap ?? 0)} points behind.`;
        case "ahead": return `${p.work.pct}% of the work is accepted with only ${p.time.pct}% of the time used: ahead of schedule.`;
        case "on_pace": return `Work and time are in step: ${p.work.pct}% accepted, ${p.time.pct}% of the time used.`;
    }
}

/** How far from fine a project is, for picking the one that needs attention first. */
function concern(p: Pace): number {
    if (p.state === "past_end") return 1000 + p.daysOver;
    return (p.state === "behind" ? -(p.gap ?? 0) : 0) + p.overdue * 5;
}

/**
 * The page's summary, most important first: how the active projects stand,
 * the one that needs attention, what waits on the PM, and who carries the
 * most open work.
 */
export function headlines({ projects, review, crew, whose }: {
    projects: { title: string; pace: Pace }[];
    review: number;
    crew: { name: string; open: number; late: number }[];
    whose: "your" | "their";
}): string[] {
    if (projects.length === 0)
        return ["No active projects right now."];
    const order: PaceState[] = ["on_pace", "ahead", "behind", "past_end", "not_started", "no_tasks"];
    const words: Partial<Record<PaceState, string>> = { on_pace: "on pace", ahead: "ahead", behind: "behind", past_end: "past the handover date", not_started: "not started", no_tasks: "without tasks" };
    const parts = order.map((s) => [s, projects.filter((p) => p.pace.state === s).length] as const).filter(([, n]) => n > 0);
    const lines = [projects.length === 1
        ? `1 active project: ${words[parts[0][0]]}.`
        : `${projects.length} active projects: ${parts.map(([s, n]) => `${n} ${words[s]}`).join(", ")}.`];
    const worst = [...projects].sort((a, b) => concern(b.pace) - concern(a.pace))[0];
    if (concern(worst.pace) > 0) {
        const p = worst.pace;
        const why = [
            p.state === "past_end" ? `${plural(p.daysOver, "day")} past its handover date` : p.state === "behind" ? `${-(p.gap ?? 0)} points behind` : "",
            p.overdue ? `${plural(p.overdue, "task")} overdue` : "",
        ].filter(Boolean);
        lines.push(`${worst.title} needs attention: ${why.join(", ")}.`);
    }
    lines.push(review === 0 ? `Nothing is waiting for ${whose} review.` : `${plural(review, "task")} ${review === 1 ? "is" : "are"} waiting for ${whose} review.`);
    const top = [...crew].sort((a, b) => b.open - a.open || b.late - a.late)[0];
    if (top && top.open > 0)
        lines.push(`${top.name} carries the most open work: ${plural(top.open, "task")}${top.late ? `, ${top.late} late` : ""}.`);
    return lines;
}

export type StepState = "on_time" | "late" | "missed" | "due";
export type Step = {
    id: string;
    title: string;
    due: string;
    /** Delivery date, or null while open. */
    done: string | null;
    state: StepState;
    /** Late: days after the due date it was delivered. Missed: days overdue. Due: days until due. */
    days: number;
    /** Its tasks accepted, of all its tasks. */
    tasks: Ratio;
};

/** A project's milestones in date order, each with where it stands today and its tasks accepted. */
export function milestoneSteps(milestones: { id: string; title: string; due_date: string; completed_at: string | null }[], tasks: { milestone_id: string | null; stage: string }[], today: string): Step[] {
    return [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date) || a.title.localeCompare(b.title)).map((m) => {
        const done = m.completed_at ? isoDateIn(m.completed_at) : null;
        const own = tasks.filter((t) => t.milestone_id === m.id);
        const base = { id: m.id, title: m.title, due: m.due_date, done, tasks: ratio(own.filter((t) => t.stage === "done").length, own.length) };
        if (done)
            return done <= m.due_date ? { ...base, state: "on_time" as const, days: 0 } : { ...base, state: "late" as const, days: daysBetween(m.due_date, done) };
        return m.due_date < today ? { ...base, state: "missed" as const, days: daysBetween(m.due_date, today) } : { ...base, state: "due" as const, days: daysBetween(today, m.due_date) };
    });
}

const shortDate = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

export function stepPhrase(s: Step): string {
    switch (s.state) {
        case "on_time": return `Delivered ${shortDate(s.done!)}, on time`;
        case "late": return `Delivered ${shortDate(s.done!)}, ${plural(s.days, "day")} late`;
        case "missed": return `Not delivered, ${plural(s.days, "day")} overdue`;
        case "due": return s.days === 0 ? "Due today" : s.days === 1 ? `Due tomorrow, ${shortDate(s.due)}` : `Due in ${s.days} days, ${shortDate(s.due)}`;
    }
}

/** Where one project is in its schedule and what comes next, in two short sentences. */
export function timelineSentence(project: { start: string; end: string; completedAt: string | null }, steps: Step[], today: string): string {
    const planned = daysBetween(project.start, project.end) + 1;
    const where = project.completedAt ? `Handed over ${shortDate(isoDateIn(project.completedAt))}.`
        : today < project.start ? `Starts in ${plural(daysBetween(today, project.start), "day")}, on ${shortDate(project.start)}.`
            : today > project.end ? `${plural(daysBetween(project.end, today), "day")} past its handover date.`
                : `Day ${daysBetween(project.start, today) + 1} of ${planned}.`;
    if (steps.length === 0)
        return `${where} No milestones set yet.`;
    const delivered = steps.filter((s) => s.done).length, missed = steps.filter((s) => s.state === "missed").length;
    const next = steps.find((s) => s.state === "due");
    return `${where} ${delivered} of ${steps.length} milestones delivered${missed ? `, ${missed} missed` : ""}. ${next ? `Next: ${next.title}, due ${shortDate(next.due)}.` : delivered === steps.length ? "All milestones delivered." : ""}`.trim();
}
