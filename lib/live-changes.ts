import { checklistProgress } from "./board-workflow.ts";
import type { TaskStage } from "../types/enums";

/**
 * Pure rules behind live task updates: which tasks to flash on the board
 * after the server's copy arrives, and which echoes are this browser's own.
 */
export type LiveTaskRow = {
    id: string;
    project_id: string;
    title: string;
    stage: TaskStage;
    assigned_to: string | null;
};

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

/**
 * Task writes this browser made itself. Their echo from the server is not
 * refreshed for: the writer already updated its own view.
 */
const ownChanges = new Map<string, number>();
// An echo lands within a second or so; short enough that a teammate's next change to the same task still comes through.
const OWN_CHANGE_MS = 5_000;

export function noteOwnChange(taskId: string, now = Date.now()) {
    for (const [id, at] of ownChanges)
        if (now - at >= OWN_CHANGE_MS)
            ownChanges.delete(id);
    ownChanges.set(taskId, now);
}

export function isOwnChange(taskId: string, now = Date.now()) {
    const at = ownChanges.get(taskId);
    return at !== undefined && now - at < OWN_CHANGE_MS;
}
