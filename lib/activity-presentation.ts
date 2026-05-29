import type { ActivityWithActor } from "@/services/activity-service";
import { TASK_STAGE_LABELS } from "@/lib/constants";
export function formatActivitySentence(row: ActivityWithActor): string {
    const who = row.actor?.full_name?.split(" ")[0] ?? "Someone";
    const d = row.details ?? {};
    switch (row.action_type) {
        case "project_created":
            return `${who} created project ${String(d.title ?? "Untitled")}`;
        case "task_created":
            return `${who} added task “${String(d.title ?? "")}”`;
        case "task_moved":
            return `${who} moved “${String(d.title ?? "Task")}” from ${TASK_STAGE_LABELS[String(d.from) as keyof typeof TASK_STAGE_LABELS] ?? d.from} to ${TASK_STAGE_LABELS[String(d.to) as keyof typeof TASK_STAGE_LABELS] ?? d.to}`;
        case "task_updated":
            return `${who} updated task “${String(d.title ?? "")}”`;
        case "milestone_completed":
            return `${who} completed milestone “${String(d.title ?? "")}”`;
        case "project_completed":
            return `${who} formally closed project “${String(d.title ?? "")}”`;
        case "milestone_rescheduled":
            return `${who} rescheduled “${String(d.title ?? "")}” to ${String(d.due_date ?? "")}`;
        case "status_changed":
            if (d.formally_closed) {
                return `${who} formally closed project “${String(d.title ?? "")}”`;
            }
            return `${who} updated project settings`;
        case "file_uploaded":
            return `${who} uploaded ${String(d.file_name ?? "a file")}`;
        case "message_sent":
            return `${who} sent a message`;
        case "member_added":
            return `${who} added a team member`;
        case "comment_added":
            return `${who} commented`;
        default:
            return `${who} performed ${row.action_type}`;
    }
}
