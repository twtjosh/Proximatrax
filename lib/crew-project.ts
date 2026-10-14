import { daysBetween, type DashboardMilestone } from "./dashboard.ts";
import type { ProjectStatus } from "../types/enums";

/**
 * Pure derivations behind a middleman's project pages. Like lib/pm-project.ts,
 * nothing new is decided here: accepted means stage "done", waiting on the PM
 * means "review", sent back means returned from review and in progress again.
 *
 * Relative imports (type-only for aliases) keep this runnable by `node --test`.
 */
export type CrewTask = {
    id: string;
    stage: string;
    due_date: string | null;
    assigned_to: string | null;
    milestone_id: string | null;
};

const isToDo = (t: Pick<CrewTask, "stage">) => t.stage === "to_do" || t.stage === "backlog";
const byDue = (a: Pick<CrewTask, "due_date">, b: Pick<CrewTask, "due_date">) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");

export type CrewStage = "unavailable" | "closed" | "paused" | "idle" | "running";

/** What the crew Overview is for right now. */
export function crewStage(status: ProjectStatus, mine: number, open: number, loadFailed = false): CrewStage {
    if (status === "completed")
        return "closed";
    if (loadFailed)
        return "unavailable";
    if (status === "on_hold")
        return "paused";
    return mine === 0 && open === 0 ? "idle" : "running";
}

export type CrewLanes<T> = { sentBack: T[]; inProgress: T[]; review: T[]; toDo: T[]; accepted: T[] };

/** The viewer's tasks by what they need from them, each lane soonest due first (undated last). */
export function crewLanes<T extends CrewTask>(tasks: T[], viewerId: string, sentBack: Set<string>): CrewLanes<T> {
    const mine = tasks.filter((t) => t.assigned_to === viewerId).sort(byDue);
    return {
        sentBack: mine.filter((t) => t.stage === "in_progress" && sentBack.has(t.id)),
        inProgress: mine.filter((t) => t.stage === "in_progress" && !sentBack.has(t.id)),
        review: mine.filter((t) => t.stage === "review"),
        toDo: mine.filter(isToDo),
        accepted: mine.filter((t) => t.stage === "done"),
    };
}

/** The one task to act on next: sent back, then overdue, then in progress, then to do; soonest due breaks ties. */
export function nextMove<T extends CrewTask>(tasks: T[], viewerId: string, sentBack: Set<string>, today: string): T | null {
    const rank = (t: T) => (t.stage === "in_progress" && sentBack.has(t.id) ? 0 : t.due_date !== null && t.due_date < today ? 1 : t.stage === "in_progress" ? 2 : 3);
    const open = tasks.filter((t) => t.assigned_to === viewerId && (t.stage === "in_progress" || isToDo(t)));
    return [...open].sort((a, b) => rank(a) - rank(b) || byDue(a, b))[0] ?? null;
}

/** Unassigned work anyone on the crew may take, soonest due first. */
export function openWork<T extends CrewTask>(tasks: T[]): T[] {
    return tasks.filter((t) => t.assigned_to === null && isToDo(t)).sort(byDue);
}

/** How much of the viewer's work here the PM has accepted. */
export function myShare(tasks: CrewTask[], viewerId: string): { accepted: number; total: number } {
    const mine = tasks.filter((t) => t.assigned_to === viewerId);
    return { accepted: mine.filter((t) => t.stage === "done").length, total: mine.length };
}

/** The header's health words. Work waiting on the PM is not the viewer's lateness. */
export function crewHealth(status: ProjectStatus, tasks: CrewTask[], viewerId: string, today: string): { text: string; tone: "late" | "done" | "steady" } {
    if (status === "completed")
        return { text: "Completed", tone: "done" };
    const late = tasks.filter((t) => t.assigned_to === viewerId && t.due_date !== null && t.due_date < today && t.stage !== "done" && t.stage !== "review").length;
    return late > 0 ? { text: `${late} of yours overdue`, tone: "late" } : { text: "On track", tone: "steady" };
}

export type FeedState = "delivered" | "late" | "next" | "upcoming";
export type MilestoneFeedItem<T> = { id: string; title: string; due_date: string; state: FeedState; accepted: number; total: number; mine: T[] };

/** Milestones in date order with the project's progress in each and the viewer's tasks inside it. */
export function milestoneFeed<T extends CrewTask>(milestones: DashboardMilestone[], tasks: T[], viewerId: string, today: string): MilestoneFeedItem<T>[] {
    const sorted = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date));
    const nextId = sorted.find((m) => !m.completed && m.due_date >= today)?.id;
    return sorted.map((m) => {
        const linked = tasks.filter((t) => t.milestone_id === m.id);
        const state: FeedState = m.completed ? "delivered" : m.due_date < today ? "late" : m.id === nextId ? "next" : "upcoming";
        return {
            id: m.id,
            title: m.title,
            due_date: m.due_date,
            state,
            accepted: linked.filter((t) => t.stage === "done").length,
            total: linked.length,
            mine: linked.filter((t) => t.assigned_to === viewerId).sort(byDue),
        };
    });
}

export type SiteNext = { title: string; due_date: string; days: number; mine: number };

/** The first milestone not yet delivered: days left (negative when late) and how many of the viewer's tasks feed it. */
export function siteNext<T extends CrewTask>(feed: MilestoneFeedItem<T>[], today: string): SiteNext | null {
    const m = feed.find((f) => f.state !== "delivered");
    return m ? { title: m.title, due_date: m.due_date, days: daysBetween(today, m.due_date), mine: m.mine.length } : null;
}

export type PhotoStatus = "shown" | "with_pm" | "not_shared";

/** Where one of the viewer's photos stands: shown once the PM approves it for the client, with the PM while its task is in review. */
export function photoStatus(approvedForClientAt: string | null, taskStage: string | undefined): PhotoStatus {
    if (approvedForClientAt)
        return "shown";
    return taskStage === "review" ? "with_pm" : "not_shared";
}
