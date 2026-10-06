import type { ProjectStatus, TaskStage, UserRole } from "@/types/enums";

/**
 * The single source of user-facing names for workflow states.
 *
 * Every screen, badge, filter and activity sentence reads its labels from
 * here so a task never appears as "Review" on one screen and "Inspection"
 * on another. Tones map to the status colours in app/globals.css.
 */
export type StatusTone = "neutral" | "info" | "warning" | "success" | "danger";

type StatusTerm = {
    label: string;
    tone: StatusTone;
};

export const TASK_STAGE_TERMS: Record<TaskStage, StatusTerm> = {
    backlog: { label: "To do", tone: "neutral" },
    to_do: { label: "To do", tone: "neutral" },
    in_progress: { label: "In progress", tone: "info" },
    review: { label: "In review", tone: "warning" },
    done: { label: "Accepted", tone: "success" },
};

export const PROJECT_STATUS_TERMS: Record<ProjectStatus, StatusTerm> = {
    pending_invites: { label: "Awaiting invites", tone: "warning" },
    planning: { label: "Planning", tone: "neutral" },
    in_progress: { label: "In progress", tone: "info" },
    on_hold: { label: "On hold", tone: "neutral" },
    completed: { label: "Completed", tone: "success" },
};

export const ROLE_TERMS: Record<UserRole, string> = {
    super_admin: "Super admin",
    project_manager: "Project manager",
    middleman: "Middleman",
    client: "Client",
};

export const COMPANY_NAME = "AEG Home Fashion";
