import { parseChecklist, type BoardColumnStage } from "@/lib/board-workflow";
import type { TaskWithRelations } from "@/services/task-service";

export const COLUMNS: { stage: BoardColumnStage; label: string; hint: string; dot: string }[] = [
    { stage: "to_do", label: "To do", hint: "Not started", dot: "bg-stage-todo" },
    { stage: "in_progress", label: "In progress", hint: "On site now", dot: "bg-stage-progress" },
    { stage: "review", label: "In review", hint: "Waiting on you", dot: "bg-stage-review" },
    { stage: "done", label: "Accepted", hint: "On the client's record", dot: "bg-stage-done" },
];
export const isLate = (t: Pick<TaskWithRelations, "due_date" | "stage">, today: string) => !!t.due_date && t.due_date < today && t.stage !== "done";
/** The newest unticked "Fix: …" item: why the PM sent this back. */
export const fixReason = (t: Pick<TaskWithRelations, "checklist">) => parseChecklist(t.checklist).find((c) => !c.done && c.label.startsWith("Fix: "))?.label.slice(5) ?? null;
