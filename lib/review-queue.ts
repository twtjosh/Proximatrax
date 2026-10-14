import type { ChecklistItem } from "./board-workflow.ts";

/** Work waiting on the PM, oldest submission first. */
export function reviewQueue<T extends { stage: string; updated_at: string }>(tasks: T[]): T[] {
    return tasks.filter((t) => t.stage === "review").sort((a, b) => a.updated_at.localeCompare(b.updated_at));
}

/** A send-back reason becomes the first, unticked checklist item, so the crew see exactly what to fix. */
export function sendBackChecklist(checklist: ChecklistItem[], reason: string, id: string): ChecklistItem[] {
    return [{ id, label: `Fix: ${reason.trim()}`, done: false }, ...checklist];
}
