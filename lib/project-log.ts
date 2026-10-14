import { formatDate } from "./dashboard.ts";

/**
 * The project log: what each activity row says, which kind it is for the
 * filters, and the PM's latest status update. Pure, so `node --test` runs it.
 */

export type Health = "on_track" | "at_risk" | "off_track";
export const HEALTH: Record<Health, { label: string; tone: "success" | "warning" | "danger" }> = {
    on_track: { label: "On track", tone: "success" },
    at_risk: { label: "At risk", tone: "warning" },
    off_track: { label: "Off track", tone: "danger" },
};
export const isHealth = (v: unknown): v is Health => v === "on_track" || v === "at_risk" || v === "off_track";

export type LogKind = "update" | "task" | "review" | "schedule" | "file" | "team" | "discussion";
export const LOG_KINDS: { kind: LogKind; label: string }[] = [
    { kind: "update", label: "Updates" },
    { kind: "review", label: "Reviews" },
    { kind: "task", label: "Tasks" },
    { kind: "schedule", label: "Schedule" },
    { kind: "file", label: "Files" },
    { kind: "discussion", label: "Discussion" },
    { kind: "team", label: "Team" },
];

export type LogRow = { action_type: string; details: Record<string, unknown> | null; created_at: string; user_id?: string | null };

const STAGE: Record<string, string> = { backlog: "To do", to_do: "To do", in_progress: "In progress", review: "In review", done: "Accepted" };
const q = (v: unknown) => `“${String(v ?? "").trim() || "a task"}”`;

export function logKind(row: LogRow): LogKind {
    const d = row.details ?? {};
    switch (row.action_type) {
        case "project_update":
        case "project_completed":
        case "status_changed":
        case "project_created":
            return "update";
        case "task_moved":
            return d.to === "done" || d.to === "review" || (d.from === "review" && d.to === "in_progress") ? "review" : "task";
        case "milestone_completed":
        case "milestone_rescheduled":
            return "schedule";
        case "file_uploaded":
            return "file";
        case "comment_added":
        case "message_sent":
            return "discussion";
        case "member_added":
        case "member_removed":
            return "team";
        default:
            return "task";
    }
}

/** What happened, without who did it: "accepted “Pour the footing”". */
export function logSentence(row: LogRow): string {
    const d = row.details ?? {};
    switch (row.action_type) {
        case "project_created":
            return "created the project";
        case "task_created":
            return `added ${q(d.title)}`;
        case "task_updated":
            return `updated ${q(d.title)}`;
        case "task_moved":
            if (d.to === "done")
                return `accepted ${q(d.title)}`;
            if (d.to === "review")
                return `submitted ${q(d.title)} for review`;
            if (d.from === "review" && d.to === "in_progress")
                return `sent back ${q(d.title)}`;
            if (d.from === "to_do" && d.to === "in_progress")
                return `started ${q(d.title)}`;
            return `moved ${q(d.title)} to ${STAGE[String(d.to)] ?? String(d.to)}`;
        case "milestone_completed":
            return `delivered ${q(d.title)}`;
        case "milestone_rescheduled":
            return `moved ${q(d.title)} to ${typeof d.due_date === "string" ? formatDate(d.due_date, { month: "short", day: "numeric" }) : "a new date"}`;
        case "file_uploaded":
            return `uploaded ${String(d.file_name ?? "a file")}`;
        case "comment_added":
            return `commented on ${q(d.title)}`;
        case "message_sent":
            return "sent a message";
        case "member_added":
            return d.name ? `added ${String(d.name)} to the team` : "joined the team";
        case "member_removed":
            return `took ${String(d.name ?? "someone")} off the project`;
        case "project_update":
            return `posted an update: ${isHealth(d.health) ? HEALTH[d.health].label : "status"}`;
        case "project_completed":
            return "closed the project";
        case "status_changed":
            return d.formally_closed ? "closed the project" : "updated the project details";
        default:
            return "made a change";
    }
}

/** The extra line some rows carry: the update's note, a send-back reason, a comment. */
export function logDetail(row: LogRow): string | null {
    const d = row.details ?? {};
    const text = row.action_type === "project_update" ? d.note : row.action_type === "comment_added" ? d.excerpt : row.action_type === "task_moved" ? d.reason : null;
    return typeof text === "string" && text.trim() ? text.trim() : null;
}

export type StatusUpdate = { health: Health; note: string; at: string; by: string | null };

/** The newest status update the PM posted, if any. Rows are newest first. */
export function latestUpdate(rows: LogRow[]): StatusUpdate | null {
    const row = rows.find((r) => r.action_type === "project_update" && isHealth(r.details?.health));
    if (!row)
        return null;
    return { health: row.details!.health as Health, note: String(row.details?.note ?? ""), at: row.created_at, by: row.user_id ?? null };
}
