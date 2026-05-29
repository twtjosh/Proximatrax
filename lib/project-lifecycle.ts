import type { Milestone, Project, Task } from "@/types/database";
export type ProjectLifecycleView = "active" | "completed";
export const DEFAULT_COMPLETION_STATEMENT = "All contractual phases and deliverables for this engagement have been completed, reviewed, and accepted. This project is formally closed and archived for reference.";
export function isProjectArchived(project: Pick<Project, "status">): boolean {
    return project.status === "completed";
}
export type ClosureReadiness = {
    ready: boolean;
    milestonesTotal: number;
    milestonesDelivered: number;
    tasksTotal: number;
    tasksAccepted: number;
    blockers: string[];
};
export function assessProjectClosureReadiness(project: Pick<Project, "status">, milestones: Pick<Milestone, "completed">[], tasks: Pick<Task, "stage">[]): ClosureReadiness {
    const blockers: string[] = [];
    if (isProjectArchived(project)) {
        blockers.push("This engagement is already formally closed.");
    }
    const milestonesTotal = milestones.length;
    const milestonesDelivered = milestones.filter((m) => m.completed).length;
    if (milestonesTotal === 0) {
        blockers.push("Define at least one project phase before closing.");
    }
    else if (milestonesDelivered < milestonesTotal) {
        blockers.push(`${milestonesTotal - milestonesDelivered} phase(s) are not yet delivered.`);
    }
    const tasksTotal = tasks.length;
    const tasksAccepted = tasks.filter((t) => t.stage === "done").length;
    if (tasksTotal > 0 && tasksAccepted < tasksTotal) {
        blockers.push(`${tasksTotal - tasksAccepted} task(s) are not yet in Accepted.`);
    }
    return {
        ready: blockers.length === 0,
        milestonesTotal,
        milestonesDelivered,
        tasksTotal,
        tasksAccepted,
        blockers,
    };
}
export function splitProjectsByLifecycle<T extends Pick<Project, "status">>(projects: T[]): {
    active: T[];
    completed: T[];
} {
    const active: T[] = [];
    const completed: T[] = [];
    for (const project of projects) {
        if (isProjectArchived(project))
            completed.push(project);
        else
            active.push(project);
    }
    return { active, completed };
}
