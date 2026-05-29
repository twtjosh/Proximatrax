export type UserRole = "super_admin" | "project_manager" | "middleman" | "client";
export type ProjectStatus = "pending_invites" | "planning" | "in_progress" | "on_hold" | "completed";
export type ProjectInvitationStatus = "pending" | "accepted" | "declined";
export type ProjectInviteeRole = "client" | "middleman";
export type TaskStage = "backlog" | "to_do" | "in_progress" | "review" | "done";
export type ActivityActionType = "task_moved" | "comment_added" | "file_uploaded" | "milestone_completed" | "project_completed" | "project_created" | "member_added" | "status_changed" | "task_created" | "task_updated" | "message_sent" | "milestone_rescheduled";
export type TaskPriority = "low" | "medium" | "high";
