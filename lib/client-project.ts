import { daysBetween, formatDate, isoDateIn, plural, type DashboardMilestone } from "./dashboard.ts";
import { PROJECT_STATUS_TERMS } from "./vocabulary.ts";
import type { ProjectStatus } from "../types/enums";

/**
 * Pure derivations behind a client's project pages. Clients see progress in
 * milestones, never task counts, and only work the PM accepted.
 *
 * Relative imports (type-only for aliases) keep this runnable by `node --test`.
 */
export type ClientStage = "planning" | "running" | "delivered" | "closed";

/**
 * What the client Overview is for right now. A project still marked as
 * planning is under way once a milestone is delivered or work is accepted.
 */
export function clientStage(status: ProjectStatus, milestones: Pick<DashboardMilestone, "completed">[], accepted = 0): ClientStage {
    if (status === "completed")
        return "closed";
    if ((status === "pending_invites" || status === "planning") && accepted === 0 && !milestones.some((m) => m.completed))
        return "planning";
    return milestones.length > 0 && milestones.every((m) => m.completed) ? "delivered" : "running";
}

const undelivered = (milestones: DashboardMilestone[]) => milestones.filter((m) => !m.completed).sort((a, b) => a.due_date.localeCompare(b.due_date));
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/** The header's health words: the earliest late milestone by name, else on track. */
export function clientHealth(status: ProjectStatus, milestones: DashboardMilestone[], today: string): { text: string; tone: "late" | "done" | "steady" } {
    if (status === "completed")
        return { text: "Completed", tone: "done" };
    if (status === "on_hold")
        return { text: PROJECT_STATUS_TERMS.on_hold.label, tone: "steady" };
    const late = undelivered(milestones).find((m) => m.due_date < today);
    return late ? { text: `${late.title} ${plural(daysBetween(late.due_date, today), "day")} late`, tone: "late" } : { text: "On track", tone: "steady" };
}

/** One plain sentence about the next milestone, honest when it is late; null when none is left. */
export function nextMilestoneSentence(milestones: DashboardMilestone[], today: string): { text: string; late: boolean } | null {
    const next = undelivered(milestones)[0];
    if (!next)
        return null;
    const days = daysBetween(today, next.due_date);
    if (days < 0)
        return { text: `${next.title} was due ${short(next.due_date)} · ${plural(-days, "day")} past its date`, late: true };
    if (days === 0)
        return { text: `Next: ${next.title}, due today`, late: false };
    if (days === 1)
        return { text: `Next: ${next.title}, due tomorrow`, late: false };
    return { text: `Next: ${next.title}, due ${short(next.due_date)} · in ${plural(days, "day")}`, late: false };
}

export type Update = { id: string; milestone_id: string | null; at: string };
/** Accepted work by the Manila day it was accepted, newest day and newest entry first. */
export function groupByDay<T extends Update>(updates: T[]): { day: string; items: T[] }[] {
    const days = new Map<string, T[]>();
    for (const u of [...updates].sort((a, b) => Date.parse(b.at) - Date.parse(a.at))) {
        const day = isoDateIn(u.at);
        days.set(day, [...(days.get(day) ?? []), u]);
    }
    return [...days].map(([day, items]) => ({ day, items }));
}

/** The milestone the Overview opens on: the earliest not yet delivered, else the last one. */
export function focusMilestone(milestones: DashboardMilestone[]): string | null {
    return undelivered(milestones)[0]?.id ?? [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).at(-1)?.id ?? null;
}

/** Items newer than the last visit. Instants are compared, since Postgres and JS format them differently. */
export function newSince<T extends { at: string }>(items: T[], baseline: string | null): T[] {
    if (!baseline)
        return [];
    const since = Date.parse(baseline);
    return items.filter((i) => Date.parse(i.at) > since);
}

/** "since earlier today", "since yesterday", "since Tuesday", else "since Sep 10". */
export function sinceLabel(baseline: string, today: string): string {
    const day = isoDateIn(baseline);
    const days = daysBetween(day, today);
    if (days <= 0)
        return "since earlier today";
    if (days === 1)
        return "since yesterday";
    if (days < 7)
        return `since ${formatDate(day, { weekday: "long" })}`;
    return `since ${short(day)}`;
}

/** "Kitchen cabinets · Fit-out · approved Sep 20". */
export function photoCaption(taskTitle: string, milestoneTitle: string | null, at: string): string {
    return [taskTitle, milestoneTitle, `approved ${short(isoDateIn(at))}`].filter(Boolean).join(" · ");
}

export type ApprovedRow = {
    id: string;
    task_id: string;
    storage_path: string;
    media_kind: string;
    approved_for_client_at: string | null;
    task: { title: string; milestone_id: string | null } | null;
};
export type ClientPhoto = { id: string; url: string; task_id: string; taskTitle: string; milestone_id: string | null; at: string };

/** The photos a client may see: photos (not files or videos) the PM approved for them. */
export function toClientPhotos(rows: ApprovedRow[], urlFor: (path: string) => string): ClientPhoto[] {
    return rows.filter((r) => r.media_kind === "photo" && r.approved_for_client_at).map((r) => ({
        id: r.id,
        url: urlFor(r.storage_path),
        task_id: r.task_id,
        taskTitle: r.task?.title ?? "Site photo",
        milestone_id: r.task?.milestone_id ?? null,
        at: r.approved_for_client_at!,
    }));
}

export type StorageLike = { getItem(key: string): string | null; setItem(key: string, value: string): void };

/** This long without a view ends a visit; the next view starts a new one. */
const VISIT_GAP_MS = 30 * 60 * 1000;

/**
 * When the viewer last looked at this project before the current visit, or
 * null on a first visit or with storage blocked. Every read records `now` as
 * the last view; the tab holds the baseline while the visit lasts, so every
 * page in it compares against the same moment, and a tab left open for hours
 * starts a fresh visit when the viewer comes back.
 */
export function readVisitBaseline(projectId: string, session: StorageLike, local: StorageLike, now: string): string | null {
    const key = `ptx:visit:${projectId}`;
    try {
        const held = session.getItem(key);
        const visit = held ? JSON.parse(held) as { base: string; seen: string } : null;
        const ongoing = visit !== null && Date.parse(now) - Date.parse(visit.seen) < VISIT_GAP_MS;
        const base = ongoing ? visit.base : local.getItem(key) ?? "";
        session.setItem(key, JSON.stringify({ base, seen: now }));
        local.setItem(key, now);
        return base || null;
    }
    catch {
        return null;
    }
}
