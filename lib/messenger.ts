import type { TeamMember } from "./data/project-context";
import type { ProjectStatus } from "../types/enums";

/** One row of `chat_inbox()`: a project room's latest message and the viewer's unread count. */
export type InboxRow = {
    project_id: string;
    last_message_at: string | null;
    last_sender_id: string | null;
    last_sender_name: string | null;
    last_content: string | null;
    unread: number;
};

export type InboxProject = {
    id: string;
    title: string;
    status: ProjectStatus;
    /** The PM and client, minus the viewer. */
    people: TeamMember[];
};

export type InboxItem = InboxProject & {
    lastAt: string | null;
    preview: string;
    unread: number;
};

/** "Josh: tiles are in", "You: thanks", or "No messages yet". */
export function previewLine(row: InboxRow | undefined, viewerId: string): string {
    if (!row?.last_content)
        return "No messages yet";
    const who = row.last_sender_id === viewerId ? "You" : (row.last_sender_name ?? "Someone").split(" ")[0];
    return `${who}: ${row.last_content}`;
}

/** One item per visible project: newest conversation first, silent ones by title, closed ones apart. */
export function buildInbox(projects: InboxProject[], rows: InboxRow[], viewerId: string): { active: InboxItem[]; closed: InboxItem[] } {
    const byProject = new Map(rows.map((r) => [r.project_id, r]));
    const items = projects.map((p): InboxItem => {
        const r = byProject.get(p.id);
        return { ...p, lastAt: r?.last_message_at ?? null, preview: previewLine(r, viewerId), unread: r?.unread ?? 0 };
    });
    items.sort((a, b) => {
        if (a.lastAt && b.lastAt)
            return Date.parse(b.lastAt) - Date.parse(a.lastAt);
        if (a.lastAt || b.lastAt)
            return a.lastAt ? -1 : 1;
        return a.title.localeCompare(b.title);
    });
    return { active: items.filter((i) => i.status !== "completed"), closed: items.filter((i) => i.status === "completed") };
}

export function totalUnread(items: InboxItem[]): number {
    return items.reduce((sum, i) => sum + i.unread, 0);
}

// Same zone as BUSINESS_TIME_ZONE in lib/dashboard.ts (type-only imports keep this file testable).
const DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "Asia/Manila" });

/** "now", "45m", "5h", "2d", then "Sep 20". */
export function inboxTime(iso: string, now: Date): string {
    const minutes = Math.floor((now.getTime() - Date.parse(iso)) / 60_000);
    if (minutes < 1)
        return "now";
    if (minutes < 60)
        return `${minutes}m`;
    if (minutes < 1440)
        return `${Math.floor(minutes / 60)}h`;
    if (minutes < 10_080)
        return `${Math.floor(minutes / 1440)}d`;
    return DAY.format(new Date(iso));
}

/** Unread per project, for "Message" badges outside the messenger. */
export function unreadByProject(items: InboxItem[]): Record<string, number> {
    return Object.fromEntries(items.map((i) => [i.id, i.unread]));
}

/**
 * The open conversation. A project missing from the inbox only sends the viewer
 * back to the list once a load that began after the latest open has settled:
 * a project joined since the last load is otherwise mistaken for a forbidden one.
 */
export function resolveActive(items: InboxItem[] | null, activeId: string | null, settled: boolean): { item: InboxItem | undefined; fallBack: boolean } {
    if (!items || !activeId)
        return { item: undefined, fallBack: false };
    const item = items.find((i) => i.id === activeId);
    return { item, fallBack: !item && settled };
}
