import { projectBoardPath } from "@/lib/constants";
import { priorPhasesBlockingTask, type MilestoneGateMilestone, type MilestoneGateTask, } from "@/lib/milestone-task-gates";
export type TaskNotifySnapshot = MilestoneGateTask & {
    assigned_to: string | null;
    title: string;
    project_id: string;
};
export type WorkReadyReason = "phase_unlock" | "assigned";
export type WorkReadyCandidate = {
    task: TaskNotifySnapshot;
    userId: string;
    reason: WorkReadyReason;
    milestoneTitle?: string;
};
export function toTaskNotifySnapshots(tasks: Array<Pick<TaskNotifySnapshot, "id" | "milestone_id" | "stage" | "assigned_to" | "title" | "project_id">>): TaskNotifySnapshot[] {
    return tasks.map((t) => ({
        id: t.id,
        milestone_id: t.milestone_id,
        stage: t.stage,
        assigned_to: t.assigned_to,
        title: t.title,
        project_id: t.project_id,
    }));
}
export function findNewlyReadyAssignedTasks(before: TaskNotifySnapshot[], after: TaskNotifySnapshot[], milestones: MilestoneGateMilestone[]): WorkReadyCandidate[] {
    const results: WorkReadyCandidate[] = [];
    const seen = new Set<string>();
    for (const task of after) {
        if (!task.assigned_to || task.stage === "done")
            continue;
        const beforeTask = before.find((t) => t.id === task.id);
        const gateBefore = beforeTask ?? task;
        const blockedBefore = priorPhasesBlockingTask(gateBefore, before, milestones).blocked;
        const blockedAfter = priorPhasesBlockingTask(task, after, milestones).blocked;
        const phaseUnlocked = blockedBefore && !blockedAfter;
        const assignmentChanged = Boolean(task.assigned_to) &&
            beforeTask?.assigned_to !== task.assigned_to;
        let reason: WorkReadyReason | null = null;
        if (phaseUnlocked) {
            reason = "phase_unlock";
        }
        else if (!blockedAfter && assignmentChanged) {
            reason = "assigned";
        }
        if (!reason)
            continue;
        const key = `${task.assigned_to}:${task.id}:${reason}`;
        if (seen.has(key))
            continue;
        seen.add(key);
        const milestoneTitle = task.milestone_id
            ? milestones.find((m) => m.id === task.milestone_id)?.title
            : undefined;
        results.push({
            task,
            userId: task.assigned_to!,
            reason,
            milestoneTitle,
        });
    }
    return results;
}
export function workReadyNotificationCopy(candidate: WorkReadyCandidate): {
    title: string;
    body: string;
    href: string;
} {
    const { task, reason, milestoneTitle } = candidate;
    const href = projectBoardPath(task.project_id, {
        milestone: task.milestone_id ?? undefined,
        mine: "1",
    });
    if (reason === "phase_unlock") {
        return {
            title: `Your turn: ${task.title}`,
            body: milestoneTitle
                ? `Earlier work on “${milestoneTitle}” is complete — you can start this task now.`
                : "Earlier phase work is complete — you can start this assigned task now.",
            href,
        };
    }
    return {
        title: `Ready for you: ${task.title}`,
        body: milestoneTitle
            ? `You’ve been assigned work in “${milestoneTitle}” — it’s cleared and ready to pick up.`
            : "You’ve been assigned a task that’s ready to pick up on the board.",
        href,
    };
}
