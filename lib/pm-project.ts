import { addDays, daysBetween, openDeadlines, partitionDeadlines, plural, type DashboardMilestone, type DashboardTask, type Deadline } from "./dashboard.ts";
import { assessProjectClosureReadiness } from "./project-lifecycle.ts";
import type { ProjectStatus } from "../types/enums";

/**
 * Pure derivations behind the project manager's project pages. Like
 * lib/dashboard.ts, nothing new is decided here: accepted means stage "done",
 * waiting on the PM means "review", late means open past its due date.
 *
 * Relative imports (type-only for aliases) keep this runnable by `node --test`.
 */
export type PmTask = DashboardTask & { milestone_id: string | null; assigned_to: string | null };

export type ProjectStage = "setup" | "running" | "ready" | "closed" | "unavailable";

/**
 * What the Overview is for right now. Setup lasts until invites are answered
 * and both milestones and tasks exist. When tasks failed to load we cannot
 * tell, so the stage is unavailable rather than a misleading "setup".
 */
export function projectStage(status: ProjectStatus, milestones: Pick<DashboardMilestone, "completed">[], tasks: Pick<PmTask, "stage">[], loadFailed = false): ProjectStage {
    if (status === "completed")
        return "closed";
    if (loadFailed)
        return "unavailable";
    if (status === "pending_invites" || milestones.length === 0 || tasks.length === 0)
        return "setup";
    return assessProjectClosureReadiness({ status }, milestones, tasks).ready ? "ready" : "running";
}

export type Station = {
    id: string;
    title: string;
    due_date: string;
    state: "delivered" | "late" | "upcoming";
    accepted: number;
    total: number;
};

/** Milestones in due-date order, each with its state and how much of its linked work is accepted. */
export function journeyStations(milestones: DashboardMilestone[], tasks: PmTask[], today: string): Station[] {
    return [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).map((m) => {
        const linked = tasks.filter((t) => t.milestone_id === m.id);
        return {
            id: m.id,
            title: m.title,
            due_date: m.due_date,
            state: m.completed ? "delivered" : m.due_date < today ? "late" : "upcoming",
            accepted: linked.filter((t) => t.stage === "done").length,
            total: linked.length,
        };
    });
}

/**
 * Where today sits along stations drawn evenly apart, 0..1: by date between
 * the two stations around it, 0 before the first and 1 after the last.
 */
export function journeyProgress(stations: Pick<Station, "due_date">[], today: string): number {
    const n = stations.length;
    if (n === 0)
        return 0;
    if (n === 1)
        return today >= stations[0].due_date ? 1 : 0;
    if (today <= stations[0].due_date)
        return 0;
    if (today >= stations[n - 1].due_date)
        return 1;
    const i = stations.findIndex((s, k) => k < n - 1 && today >= s.due_date && today < stations[k + 1].due_date);
    const gap = Math.max(daysBetween(stations[i].due_date, stations[i + 1].due_date), 1);
    return (i + daysBetween(stations[i].due_date, today) / gap) / (n - 1);
}

export type LateMilestone = { id: string; title: string; due_date: string; daysLate: number; accepted: number; total: number };
export type LateTask = { id: string; title: string; due_date: string; daysLate: number; assigned_to: string | null };
export type ProjectNeeds = {
    review: { count: number; oldest: PmTask } | null;
    lateMilestones: LateMilestone[];
    lateTasks: LateTask[];
    /** Open dated work in the next 7 days (today included), soonest first. */
    comingUp: Deadline[];
    /** Rows in Needs you: one for all reviews, one per late item. */
    count: number;
};

/** Days Coming up covers after today, so the list spans a week. */
const HORIZON_DAYS = 6;

/**
 * Everything in one project waiting on the PM. Work already in review is
 * covered by the review row, so it is not listed again as late or coming up.
 */
export function projectNeeds(milestones: DashboardMilestone[], tasks: PmTask[], today: string): ProjectNeeds {
    const inReview = tasks.filter((t) => t.stage === "review").sort((a, b) => a.updated_at.localeCompare(b.updated_at));
    const notInReview = tasks.filter((t) => t.stage !== "review");
    const { overdue, upcoming } = partitionDeadlines(openDeadlines(notInReview, milestones), today, HORIZON_DAYS);
    const lateMilestones = overdue.filter((d) => d.kind === "milestone").map((d) => {
        const linked = tasks.filter((t) => t.milestone_id === d.id);
        return { id: d.id, title: d.title, due_date: d.due_date, daysLate: daysBetween(d.due_date, today), accepted: linked.filter((t) => t.stage === "done").length, total: linked.length };
    });
    const lateTasks = overdue.filter((d) => d.kind === "task").map((d) => ({
        id: d.id, title: d.title, due_date: d.due_date, daysLate: daysBetween(d.due_date, today),
        assigned_to: tasks.find((t) => t.id === d.id)?.assigned_to ?? null,
    }));
    const review = inReview.length > 0 ? { count: inReview.length, oldest: inReview[0] } : null;
    return { review, lateMilestones, lateTasks, comingUp: upcoming, count: (review ? 1 : 0) + lateMilestones.length + lateTasks.length };
}

/** The dates "Move date" offers before a free pick. */
export function quickPickDates(today: string): { label: string; date: string }[] {
    const weekday = new Date(`${today}T00:00:00Z`).getUTCDay();
    const toMonday = (8 - weekday) % 7 || 7;
    return [
        { label: "Tomorrow", date: addDays(today, 1) },
        { label: "In 3 days", date: addDays(today, 3) },
        { label: "Next Monday", date: addDays(today, toMonday) },
        { label: "In a week", date: addDays(today, 7) },
    ];
}

/** "Starts in 7 days", "12 days left", "4 days past its end". */
export function calendarPhrase(start: string, end: string, today: string): string {
    if (today < start)
        return `Starts in ${plural(daysBetween(today, start), "day")}`;
    const left = daysBetween(today, end);
    return left >= 0 ? `${plural(left, "day")} left` : `${plural(-left, "day")} past its end`;
}
