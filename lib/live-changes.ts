import { checklistProgress } from "./board-workflow.ts";
import type { TaskStage } from "../types/enums";

/**
 * Pure rules behind live task updates: which remote changes deserve a toast,
 * and which tasks to flash on the board after the server's copy arrives.
 */
export type LiveTaskRow = {
    id: string;
    project_id: string;
    title: string;
    stage: TaskStage;
    assigned_to: string | null;
};

export type LiveAudience = { role: "pm" } | { role: "crew"; viewerId: string };

export type TaskAnnouncement = { kind: "submitted" | "accepted" | "sent_back"; task: LiveTaskRow };

/**
 * A stage change worth interrupting someone for. `old` is the row before the
 * update; without REPLICA IDENTITY FULL it carries only the id, and then
 * nothing is announced rather than guessing.
 */
export function taskAnnouncement(old: Partial<LiveTaskRow> | null | undefined, next: LiveTaskRow, audience: LiveAudience): TaskAnnouncement | null {
    const from = old?.stage;
    if (!from || from === next.stage)
        return null;
    if (audience.role === "pm")
        return next.stage === "review" ? { kind: "submitted", task: next } : null;
    if (next.assigned_to !== audience.viewerId || from !== "review")
        return null;
    if (next.stage === "done")
        return { kind: "accepted", task: next };
    if (next.stage === "in_progress")
        return { kind: "sent_back", task: next };
    return null;
}

type Comparable = {
    id: string;
    title: string;
    stage: TaskStage;
    assigned_to: string | null;
    due_date: string | null;
    priority: string;
    checklist: unknown;
};

// Checklist progress, not the JSON: jsonb reorders keys, which would flash the PM's own edits.
const signature = (t: Comparable) => {
    const steps = checklistProgress(t.checklist);
    return [t.title, t.stage, t.assigned_to, t.due_date, t.priority, steps.done, steps.total].join("|");
};

/** Tasks the server changed (or added) that the local copy didn't already have that way. */
export function changedTaskIds(local: Comparable[], server: Comparable[]): string[] {
    const before = new Map(local.map((t) => [t.id, signature(t)]));
    return server.filter((t) => before.get(t.id) !== signature(t)).map((t) => t.id);
}

/** Moves this browser made itself, so their echo from the server isn't announced back. */
const ownMoves = new Map<string, number>();
const OWN_MOVE_MS = 15_000;

export function noteOwnMove(taskId: string, now = Date.now()) {
    ownMoves.set(taskId, now);
}

export function isOwnMove(taskId: string, now = Date.now()) {
    const at = ownMoves.get(taskId);
    return at !== undefined && now - at < OWN_MOVE_MS;
}
