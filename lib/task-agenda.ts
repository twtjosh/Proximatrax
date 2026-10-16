import { addDays, daysBetween, formatDate, plural } from "./dashboard.ts";

/**
 * The task list as an agenda: every task in the group that says what it
 * needs. Accepted and in-review work are placed by stage; the rest by when
 * it is due. Pure, so `node --test` can run it. Dates are ISO calendar dates.
 */

type AgendaTask = { id: string; stage: string; due_date: string | null; assigned_to: string | null; position: number };

export type AgendaKey = "late" | "review" | "week" | "next" | "later" | "none" | "done";
export type AgendaFilter = "late" | "review" | "week" | "unassigned" | null;

/** Attention order: what is late, what waits on the PM, then the calendar, then what is finished. */
export const AGENDA: { key: AgendaKey; label: string }[] = [
    { key: "late", label: "Late" },
    { key: "review", label: "Waiting for your review" },
    { key: "week", label: "This week" },
    { key: "next", label: "Next week" },
    { key: "later", label: "Later" },
    { key: "none", label: "No due date" },
    { key: "done", label: "Accepted" },
];

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

export function agendaBucket(task: Pick<AgendaTask, "stage" | "due_date">, today: string): AgendaKey {
    if (task.stage === "done")
        return "done";
    if (task.stage === "review")
        return "review";
    if (!task.due_date)
        return "none";
    if (task.due_date < today)
        return "late";
    const days = daysBetween(today, task.due_date);
    return days <= 6 ? "week" : days <= 13 ? "next" : "later";
}

/** Non-empty groups in attention order, each soonest first (board order breaks ties). */
export function agendaGroups<T extends AgendaTask>(tasks: T[], today: string): { key: AgendaKey; label: string; tasks: T[] }[] {
    const sorted = [...tasks].sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999") || a.position - b.position);
    return AGENDA
        .map((g) => ({ ...g, tasks: sorted.filter((t) => agendaBucket(t, today) === g.key) }))
        .filter((g) => g.tasks.length > 0);
}

export function agendaCounts(tasks: AgendaTask[], today: string) {
    const n = (f: Exclude<AgendaFilter, null>) => tasks.filter((t) => matchesAgendaFilter(t, f, today)).length;
    return { late: n("late"), review: n("review"), week: n("week"), unassigned: n("unassigned") };
}

/** "With no one" means open work nobody has yet; the others are agenda groups. */
export function matchesAgendaFilter(task: AgendaTask, filter: AgendaFilter, today: string): boolean {
    if (!filter)
        return true;
    if (filter === "unassigned")
        return !task.assigned_to && task.stage !== "done";
    return agendaBucket(task, today) === filter;
}

/** The quiet line beside a group's name. */
export function bucketNote(key: AgendaKey, today: string): string {
    switch (key) {
        case "late": return "Past their due date";
        case "review": return "Submitted by the crew";
        case "week": return `Due by ${short(addDays(today, 6))}`;
        case "next": return `Due ${short(addDays(today, 7))} to ${short(addDays(today, 13))}`;
        case "later": return `Due after ${short(addDays(today, 13))}`;
        case "none": return "Give them a date to plan around";
        case "done": return "On the client’s record";
    }
}

/** "2 days late", "Due today", "In 4 days", "In 2 weeks". */
export function relativeDue(due: string | null, stage: string, today: string): string {
    if (stage === "done")
        return "Accepted";
    if (!due)
        return "No due date";
    const n = daysBetween(today, due);
    if (n < 0)
        return `${plural(-n, "day")} late`;
    if (n === 0)
        return "Due today";
    if (n === 1)
        return "Due tomorrow";
    if (n < 7)
        return `In ${n} days`;
    const weeks = Math.round(n / 7);
    return `In ${plural(weeks, "week")}`;
}
