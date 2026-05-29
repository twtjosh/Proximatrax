import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaKindFromMime, type MediaKind } from "@/lib/media-kind";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { TaskAttachment } from "@/types/database";
const TASK_BUCKET = "project-tasks";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export function publicTaskAttachmentUrl(storagePath: string): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base)
        return storagePath;
    return `${base}/storage/v1/object/public/${TASK_BUCKET}/${storagePath}`;
}
export async function listTaskAttachmentsForProject(projectId: string, client?: SupabaseClient): Promise<TaskAttachment[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("task_attachments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (error)
        throw error;
    return (data ?? []) as TaskAttachment[];
}
export type ApprovedAttachment = TaskAttachment & {
    task: Pick<import("@/types/database").Task, "id" | "title" | "milestone_id" | "client_visible_at"> | null;
};
export async function listApprovedAttachmentsForProject(projectId: string, client?: SupabaseClient): Promise<ApprovedAttachment[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("task_attachments")
        .select("*, task:tasks ( id, title, milestone_id, client_visible_at )")
        .eq("project_id", projectId)
        .not("approved_for_client_at", "is", null)
        .order("approved_for_client_at", { ascending: false });
    if (error)
        throw error;
    return (data ?? []) as ApprovedAttachment[];
}
export async function approveTaskAttachmentsForClient(taskId: string, approvedAt: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb
        .from("task_attachments")
        .update({ approved_for_client_at: approvedAt })
        .eq("task_id", taskId);
    if (error)
        throw error;
}
export async function uploadTaskAttachment(projectId: string, taskId: string, file: File, client?: SupabaseClient): Promise<TaskAttachment> {
    const sb = resolveClient(client);
    const { data: { user }, } = await sb.auth.getUser();
    if (!user)
        throw new Error("Not authenticated.");
    const mimeType = file.type || "application/octet-stream";
    const mediaKind = mediaKindFromMime(mimeType);
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
    const storagePath = `${projectId}/${taskId}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage
        .from(TASK_BUCKET)
        .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
    });
    if (uploadError)
        throw uploadError;
    const { data: attachment, error: attachmentError } = await sb
        .from("task_attachments")
        .insert({
        task_id: taskId,
        project_id: projectId,
        storage_path: storagePath,
        file_name: file.name,
        mime_type: mimeType,
        byte_size: file.size,
        media_kind: mediaKind,
        uploaded_by: user.id,
    })
        .select("*")
        .single();
    if (attachmentError)
        throw attachmentError;
    await sb.from("activity_feed").insert({
        project_id: projectId,
        user_id: user.id,
        action_type: "file_uploaded",
        details: {
            file_name: file.name,
            media_kind: mediaKind,
            task_id: taskId,
            source: "task_board",
        },
    });
    return attachment as TaskAttachment;
}
export async function deleteTaskAttachment(attachmentId: string, storagePath: string, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error: storageError } = await sb.storage
        .from(TASK_BUCKET)
        .remove([storagePath]);
    if (storageError)
        throw storageError;
    const { error } = await sb
        .from("task_attachments")
        .delete()
        .eq("id", attachmentId);
    if (error)
        throw error;
}
export function indexAttachmentsByTask(items: TaskAttachment[]): Map<string, TaskAttachment[]> {
    const map = new Map<string, TaskAttachment[]>();
    for (const item of items) {
        const list = map.get(item.task_id) ?? [];
        list.push(item);
        map.set(item.task_id, list);
    }
    return map;
}
export function attachmentSummary(items: TaskAttachment[]): {
    count: number;
    photo: number;
    video: number;
    file: number;
} {
    let photo = 0;
    let video = 0;
    let file = 0;
    for (const item of items) {
        if (item.media_kind === "photo")
            photo += 1;
        else if (item.media_kind === "video")
            video += 1;
        else
            file += 1;
    }
    return { count: items.length, photo, video, file };
}
export function formatAttachmentSize(bytes: number | null): string {
    if (bytes == null || bytes <= 0)
        return "";
    if (bytes < 1024)
        return `${bytes} B`;
    if (bytes < 1024 * 1024)
        return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
export type { MediaKind };
