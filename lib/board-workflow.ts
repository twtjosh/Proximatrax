import type { WorkflowGateContext } from "@/lib/milestone-task-gates";
import { priorPhasesBlockingTask } from "./milestone-task-gates.ts";
import type { TaskStage, UserRole } from "@/types/enums";
export type { WorkflowGateContext };
export type BoardColumnStage = Exclude<TaskStage, "backlog">;
export const BOARD_STAGES: BoardColumnStage[] = [
    "to_do",
    "in_progress",
    "review",
    "done",
];
export const BOARD_STAGE_INDEX: Record<BoardColumnStage, number> = {
    to_do: 0,
    in_progress: 1,
    review: 2,
    done: 3,
};
export type BoardColumnMeta = {
    title: string;
    hint: string;
    owner: string;
};
export const BOARD_COLUMN_META: Record<BoardColumnStage, BoardColumnMeta> = {
    to_do: {
        title: "Ready",
        hint: "Scoped work waiting for an owner",
        owner: "Pool",
    },
    in_progress: {
        title: "Active",
        hint: "Execution on site or in studio",
        owner: "Assignee",
    },
    review: {
        title: "Inspection",
        hint: "Submitted for PM quality check",
        owner: "Project manager",
    },
    done: {
        title: "Accepted",
        hint: "Signed off and closed",
        owner: "Project record",
    },
};
export type ChecklistItem = {
    id: string;
    label: string;
    done: boolean;
};
export function parseChecklist(raw: unknown): ChecklistItem[] {
    if (!Array.isArray(raw))
        return [];
    return raw
        .map((row) => {
        if (!row || typeof row !== "object")
            return null;
        const o = row as Record<string, unknown>;
        const id = typeof o.id === "string" ? o.id : crypto.randomUUID();
        const label = typeof o.label === "string" ? o.label : "";
        const done = Boolean(o.done);
        if (!label)
            return null;
        return { id, label, done };
    })
        .filter(Boolean) as ChecklistItem[];
}
export function checklistProgress(raw: unknown): {
    total: number;
    done: number;
    complete: boolean;
} {
    const items = parseChecklist(raw);
    const done = items.filter((i) => i.done).length;
    return { total: items.length, done, complete: items.length > 0 && done === items.length };
}
export type GateFailure = {
    code: "assignee" | "checklist" | "pm_only" | "one_step" | "pm_reopen" | "prior_phase";
    message: string;
};
export type TaskForGate = {
    id?: string;
    assigned_to: string | null;
    milestone_id?: string | null;
    checklist: unknown;
    description: string | null;
    stage: TaskStage;
};
export function stageDelta(from: BoardColumnStage, to: BoardColumnStage): number {
    return BOARD_STAGE_INDEX[to] - BOARD_STAGE_INDEX[from];
}
export function normalizeBoardStage(stage: TaskStage): BoardColumnStage {
    return stage === "backlog" ? "to_do" : stage;
}
export function validateStageTransition(task: TaskForGate, from: BoardColumnStage, to: BoardColumnStage, viewerRole: UserRole, gateContext?: WorkflowGateContext): {
    ok: true;
    claimAssignee?: string;
    /** The PM is starting work ahead of an earlier milestone; the UI confirms first. */
    warning?: string;
} | {
    ok: false;
    failures: GateFailure[];
} {
    const delta = stageDelta(from, to);
    if (delta === 0)
        return { ok: true };
    if (delta < 0) {
        if (viewerRole !== "project_manager") {
            return {
                ok: false,
                failures: [
                    {
                        code: "pm_reopen",
                        message: "Only the project manager can send work backward in the pipeline.",
                    },
                ],
            };
        }
        return { ok: true };
    }
    if (delta > 1) {
        return {
            ok: false,
            failures: [
                {
                    code: "one_step",
                    message: "Work moves one stage at a time — claim, execute, submit, then sign off.",
                },
            ],
        };
    }
    if (from === "to_do" && to === "in_progress") {
        if (!task.assigned_to && viewerRole !== "middleman") {
            return {
                ok: false,
                failures: [{ code: "assignee", message: "Assign someone before starting this task." }],
            };
        }
        // The milestone order guards starting new work only; work already under way can always finish.
        const phaseBlock = gateContext && task.milestone_id
            ? priorPhasesBlockingTask({ id: task.id ?? "", milestone_id: task.milestone_id, stage: task.stage }, gateContext.tasks, gateContext.milestones)
            : { blocked: false as const };
        const claim = !task.assigned_to && viewerRole === "middleman" ? { claimAssignee: "self" } : {};
        if (phaseBlock.blocked) {
            if (viewerRole === "project_manager")
                return { ok: true, ...claim, warning: `Start before ${phaseBlock.milestone?.title ?? "the earlier milestone"} is finished?` };
            return {
                ok: false,
                failures: [{ code: "prior_phase", message: phaseBlock.message ?? "Finish the earlier milestone first." }],
            };
        }
        return { ok: true, ...claim };
    }
    if (from === "in_progress" && to === "review") {
        return { ok: true };
    }
    if (from === "review" && to === "done") {
        if (viewerRole !== "project_manager") {
            return {
                ok: false,
                failures: [
                    {
                        code: "pm_only",
                        message: "Only the project manager can accept work. Submit it for review.",
                    },
                ],
            };
        }
        return { ok: true };
    }
    return { ok: true };
}
export type NextHandoffAction = {
    label: string;
    targetStage: BoardColumnStage;
    variant: "claim" | "submit" | "approve" | "reopen";
};
export function nextHandoffAction(task: TaskForGate & {
    assigned_to: string | null;
}, viewerRole: UserRole, viewerId: string, gateContext?: WorkflowGateContext): NextHandoffAction | null {
    const stage = normalizeBoardStage(task.stage);
    if (viewerRole === "client")
        return null;
    function forwardAction(action: NextHandoffAction): NextHandoffAction | null {
        // Only starting is gated by the milestone order.
        if (!gateContext || !task.milestone_id || stage !== "to_do")
            return action;
        const phaseBlock = priorPhasesBlockingTask({
            id: task.id ?? "",
            milestone_id: task.milestone_id,
            stage: task.stage,
        }, gateContext.tasks, gateContext.milestones);
        return phaseBlock.blocked ? null : action;
    }
    if (stage === "to_do") {
        if (viewerRole === "middleman" && !task.assigned_to) {
            return forwardAction({
                label: "Claim & start",
                targetStage: "in_progress",
                variant: "claim",
            });
        }
        if (task.assigned_to === viewerId) {
            return forwardAction({
                label: "Start work",
                targetStage: "in_progress",
                variant: "claim",
            });
        }
        return null;
    }
    if (stage === "in_progress") {
        if (viewerRole === "project_manager" ||
            task.assigned_to === viewerId) {
            return forwardAction({
                label: "Submit for review",
                targetStage: "review",
                variant: "submit",
            });
        }
        return null;
    }
    if (stage === "review" && viewerRole === "project_manager") {
        return forwardAction({
            label: "Sign off & accept",
            targetStage: "done",
            variant: "approve",
        });
    }
    return null;
}
export function taskBlockedReason(task: TaskForGate, viewerRole: UserRole, gateContext?: WorkflowGateContext): string | null {
    const stage = normalizeBoardStage(task.stage);
    if (gateContext && task.milestone_id && stage === "to_do") {
        const phaseBlock = priorPhasesBlockingTask({
            id: task.id ?? "",
            milestone_id: task.milestone_id,
            stage: task.stage,
        }, gateContext.tasks, gateContext.milestones);
        if (phaseBlock.blocked && phaseBlock.milestone) {
            return `Waits for ${phaseBlock.milestone.title}`;
        }
    }
    if (stage === "to_do" && !task.assigned_to) {
        return "Needs owner";
    }
    if (stage === "in_progress") {
        return null;
    }
    if (stage === "review" && viewerRole !== "project_manager") {
        return "Awaiting PM sign-off";
    }
    return null;
}
export function boardHealthStats(tasks: TaskForGate[]): {
    readyUnowned: number;
    activeInProgress: number;
    awaitingPm: number;
    accepted: number;
} {
    let readyUnowned = 0;
    let activeInProgress = 0;
    let awaitingPm = 0;
    let accepted = 0;
    for (const t of tasks) {
        const stage = normalizeBoardStage(t.stage);
        if (stage === "to_do" && !t.assigned_to)
            readyUnowned += 1;
        if (stage === "in_progress")
            activeInProgress += 1;
        if (stage === "review")
            awaitingPm += 1;
        if (stage === "done")
            accepted += 1;
    }
    return { readyUnowned, activeInProgress, awaitingPm, accepted };
}
