export type MilestoneStatus = "completed" | "overdue" | "due_soon" | "upcoming";
export function todayIso(): string {
    return new Date().toISOString().slice(0, 10);
}
export function formatDisplayDate(value: string): string {
    return new Date(`${value}T00:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
export function getMilestoneStatus(m: {
    completed: boolean;
    due_date: string;
}): MilestoneStatus {
    if (m.completed)
        return "completed";
    const today = todayIso();
    if (m.due_date < today)
        return "overdue";
    const due = new Date(`${m.due_date}T00:00:00`);
    const now = new Date(`${today}T00:00:00`);
    const diffDays = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (diffDays <= 7)
        return "due_soon";
    return "upcoming";
}
export function formatRelativeDueDate(dueDate: string, completed?: boolean): string {
    if (completed)
        return "Completed";
    const today = todayIso();
    if (dueDate < today) {
        const due = new Date(`${dueDate}T00:00:00`);
        const now = new Date(`${today}T00:00:00`);
        const days = Math.round((now.getTime() - due.getTime()) / 86400000);
        return days === 1 ? "1 day overdue" : `${days} days overdue`;
    }
    if (dueDate === today)
        return "Due today";
    const due = new Date(`${dueDate}T00:00:00`);
    const now = new Date(`${today}T00:00:00`);
    const days = Math.round((due.getTime() - now.getTime()) / 86400000);
    if (days === 1)
        return "Due tomorrow";
    if (days <= 7)
        return `Due in ${days} days`;
    return formatDisplayDate(dueDate);
}
export function isDateOutsideProjectWindow(date: string, projectStart: string, projectEnd: string): boolean {
    return date < projectStart || date > projectEnd;
}
export const MILESTONE_STATUS_LABELS: Record<MilestoneStatus, string> = {
    completed: "Completed",
    overdue: "Overdue",
    due_soon: "Due soon",
    upcoming: "Upcoming",
};
export const MILESTONE_SUGGESTIONS = [
    "Concept approval",
    "Procurement",
    "Installation",
    "Final handover",
] as const;
export function sortMilestones<T extends {
    due_date: string;
}>(items: T[]): T[] {
    return [...items].sort((a, b) => a.due_date.localeCompare(b.due_date));
}
