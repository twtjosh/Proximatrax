import type { Milestone, Task } from "@/types/database";
import type { TaskStage } from "@/types/enums";
export type MilestoneGateTask = Pick<Task, "id" | "milestone_id" | "stage">;
export type MilestoneGateMilestone = Pick<Milestone, "id" | "due_date" | "title" | "completed">;
export type WorkflowGateContext = {
    milestones: MilestoneGateMilestone[];
    tasks: MilestoneGateTask[];
};
export function sortMilestonesByPhase(milestones: MilestoneGateMilestone[]): MilestoneGateMilestone[] {
    return [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date));
}
export function priorMilestonesFor(milestoneId: string, sortedMilestones: MilestoneGateMilestone[]): MilestoneGateMilestone[] {
    const idx = sortedMilestones.findIndex((m) => m.id === milestoneId);
    if (idx <= 0)
        return [];
    return sortedMilestones.slice(0, idx);
}
export function milestoneLinkedTasksComplete(milestoneId: string, tasks: MilestoneGateTask[]): boolean {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    if (linked.length === 0)
        return true;
    return linked.every((t) => t.stage === "done");
}
export function firstIncompletePriorMilestone(task: MilestoneGateTask, tasks: MilestoneGateTask[], milestones: MilestoneGateMilestone[]): MilestoneGateMilestone | null {
    if (!task.milestone_id)
        return null;
    const sorted = sortMilestonesByPhase(milestones);
    const prior = priorMilestonesFor(task.milestone_id, sorted);
    for (const milestone of prior) {
        if (!milestoneLinkedTasksComplete(milestone.id, tasks)) {
            return milestone;
        }
    }
    return null;
}
export function priorPhasesBlockingTask(task: MilestoneGateTask, tasks: MilestoneGateTask[], milestones: MilestoneGateMilestone[]): {
    blocked: boolean;
    message?: string;
    milestone?: MilestoneGateMilestone;
} {
    const pending = firstIncompletePriorMilestone(task, tasks, milestones);
    if (!pending)
        return { blocked: false };
    return {
        blocked: true,
        milestone: pending,
        message: `Finish all tasks linked to “${pending.title}” before working on this phase.`,
    };
}
export function shouldAutoCompleteMilestone(milestoneId: string, tasks: MilestoneGateTask[]): boolean {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    if (linked.length === 0)
        return false;
    return linked.every((t) => t.stage === "done");
}
export function shouldAutoReopenMilestone(milestoneId: string, tasks: MilestoneGateTask[]): boolean {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    if (linked.length === 0)
        return false;
    return linked.some((t) => t.stage !== "done");
}
export function toGateTasks(tasks: Array<Pick<Task, "id" | "milestone_id" | "stage">>): MilestoneGateTask[] {
    return tasks.map((t) => ({
        id: t.id,
        milestone_id: t.milestone_id,
        stage: t.stage as TaskStage,
    }));
}
