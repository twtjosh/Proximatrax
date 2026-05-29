import type { TaskPriority } from "@/types/enums";
export type PMDeadlineRow = {
    kind: "milestone";
    id: string;
    project_id: string;
    title: string;
    due_date: string;
} | {
    kind: "task";
    id: string;
    project_id: string;
    title: string;
    due_date: string;
    priority: TaskPriority;
};
export type PMScheduleItem = PMDeadlineRow & {
    overdue: boolean;
};
const PRIORITY_RANK: Record<TaskPriority, number> = {
    high: 0,
    medium: 1,
    low: 2,
};
const MILESTONE_PRIORITY_RANK = 0.5;
export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
    low: "Low",
    medium: "Medium",
    high: "High",
};
export function priorityRank(item: PMDeadlineRow): number {
    if (item.kind === "task")
        return PRIORITY_RANK[item.priority];
    return MILESTONE_PRIORITY_RANK;
}
export function comparePmScheduleItems(a: PMScheduleItem, b: PMScheduleItem): number {
    if (a.overdue !== b.overdue)
        return a.overdue ? -1 : 1;
    const pr = priorityRank(a) - priorityRank(b);
    if (pr !== 0)
        return pr;
    return a.due_date.localeCompare(b.due_date);
}
export function buildPmSchedule(overdue: PMDeadlineRow[], upcoming: PMDeadlineRow[]): PMScheduleItem[] {
    return [
        ...overdue.map((item) => ({ ...item, overdue: true as const })),
        ...upcoming.map((item) => ({ ...item, overdue: false as const })),
    ].sort(comparePmScheduleItems);
}
export function priorityBadgeClass(priority: TaskPriority): string {
    switch (priority) {
        case "high":
            return "border-error/20 bg-error-soft text-error";
        case "medium":
            return "border-copper/25 bg-copper-soft text-copper-hover";
        default:
            return "border-cool-grey bg-surface-spotlight text-muted-ink";
    }
}
export function heroLabelForItem(item: PMScheduleItem): string {
    if (item.overdue)
        return "Needs attention";
    return "Next up";
}
