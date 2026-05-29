import type { UserRole, ProjectStatus, TaskStage, ActivityActionType, TaskPriority, ProjectInvitationStatus, ProjectInviteeRole, } from "./enums";
export interface Profile {
    id: string;
    role: UserRole;
    full_name: string;
    avatar_url: string | null;
    contact_number: string | null;
    created_at: string;
    updated_at: string;
}
export interface Project {
    id: string;
    title: string;
    description: string | null;
    status: ProjectStatus;
    client_id: string;
    pm_id: string;
    start_date: string;
    end_date: string;
    completed_at: string | null;
    completed_by: string | null;
    completion_statement: string | null;
    created_at: string;
    updated_at: string;
}
export interface ProjectMember {
    project_id: string;
    user_id: string;
    role_in_project: string;
}
export interface ProjectInvitation {
    id: string;
    project_id: string;
    invitee_id: string;
    invitee_role: ProjectInviteeRole;
    status: ProjectInvitationStatus;
    invited_by: string;
    project_title: string;
    created_at: string;
    responded_at: string | null;
}
export type ProjectInvitationWithInviter = ProjectInvitation & {
    inviter: Pick<Profile, "id" | "full_name" | "avatar_url"> | null;
};
export type ProjectInvitationWithInvitee = ProjectInvitation & {
    invitee: Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null;
};
export interface Milestone {
    id: string;
    project_id: string;
    title: string;
    due_date: string;
    completed: boolean;
    created_at: string;
}
export interface Task {
    id: string;
    project_id: string;
    milestone_id: string | null;
    title: string;
    description: string | null;
    stage: TaskStage;
    assigned_to: string | null;
    priority: TaskPriority;
    due_date: string | null;
    checklist: unknown;
    position: number;
    client_visible_at: string | null;
    created_at: string;
    updated_at: string;
}
export interface ProjectAttachment {
    id: string;
    project_id: string;
    task_id: string | null;
    file_url: string;
    file_type: string;
    uploaded_by: string;
    uploaded_at: string;
}
export interface TaskAttachment {
    id: string;
    task_id: string;
    project_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    byte_size: number | null;
    media_kind: "file" | "photo" | "video";
    uploaded_by: string;
    approved_for_client_at: string | null;
    created_at: string;
}
export interface UserNotification {
    id: string;
    user_id: string;
    kind: string;
    task_id: string | null;
    milestone_id: string | null;
    project_id: string;
    title: string;
    body: string;
    href: string;
    read_at: string | null;
    created_at: string;
}
export interface ChatMessage {
    id: string;
    project_id: string;
    sender_id: string;
    content: string;
    created_at: string;
}
export interface ChatMessageAttachment {
    id: string;
    message_id: string;
    project_id: string;
    storage_path: string;
    file_name: string;
    mime_type: string;
    byte_size: number | null;
    media_kind: "file" | "photo" | "video";
    uploaded_by: string;
    created_at: string;
}
export interface ProjectChatReadCursor {
    project_id: string;
    user_id: string;
    last_read_at: string;
}
export interface ActivityFeedItem {
    id: string;
    project_id: string;
    user_id: string | null;
    action_type: ActivityActionType;
    details: Record<string, unknown>;
    created_at: string;
}
export type InquiryStatus = "new" | "contacted" | "converted" | "closed";
export interface Inquiry {
    id: string;
    name: string;
    email: string;
    message: string;
    status: InquiryStatus;
    notes: string | null;
    created_at: string;
    updated_at: string;
}
