import type { SupabaseClient } from "@supabase/supabase-js";
import { fileUrl, mediaKindFromMime, uploadTooBig, type MediaKind } from "@/lib/media-kind";
import { createClient as createBrowserClient, signedInUser } from "@/lib/supabase/client";
import { evidenceUploadError } from "@/lib/evidence";
import type { Capture } from "@/lib/photo-stamp";
import type { TaskAttachment } from "@/types/database";
const TASK_BUCKET = "project-tasks";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export function publicTaskAttachmentUrl(storagePath: string): string {
    return fileUrl(TASK_BUCKET, storagePath);
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
/** Shares chosen attachments with the client; the rest of the task's files stay with the team. */
export async function approveAttachmentsForClient(ids: string[], approvedAt: string, client?: SupabaseClient): Promise<void> {
    if (ids.length === 0)
        return;
    const sb = resolveClient(client);
    const { error } = await sb
        .from("task_attachments")
        .update({ approved_for_client_at: approvedAt })
        .in("id", ids);
    if (error)
        throw error;
}
export async function uploadTaskAttachment(projectId: string, taskId: string, file: File, client?: SupabaseClient): Promise<TaskAttachment> {
    const tooBig = uploadTooBig(file);
    if (tooBig)
        throw new Error(tooBig);
    const sb = resolveClient(client);
    const user = await signedInUser(sb);
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
    if (attachmentError) {
        await sb.storage.from(TASK_BUCKET).remove([storagePath]);
        throw attachmentError;
    }
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
/**
 * Sends a camera photo to the server, which records the time, place and
 * flags. The only way a middleman's photo reaches a task.
 */
export async function uploadSitePhoto(taskId: string, file: File, capture: Capture): Promise<TaskAttachment> {
    const tooBig = evidenceUploadError(file);
    if (tooBig)
        throw new Error(tooBig);
    const form = new FormData();
    form.set("file", file);
    form.set("takenAt", String(capture.takenAt));
    if (capture.fix) {
        form.set("lat", String(capture.fix.lat));
        form.set("lng", String(capture.fix.lng));
        form.set("accuracy", String(capture.fix.accuracy));
    }
    form.set("deviceNow", String(Date.now()));
    const res = await fetch(`/api/tasks/${encodeURIComponent(taskId)}/evidence`, { method: "POST", body: form });
    const body = await res.json().catch(() => null);
    if (!res.ok)
        throw new Error(evidenceUploadError(file, res.status, body) ?? "");
    return body as TaskAttachment;
}
/**
 * A site video in three hops: the server hands out a one-time upload link,
 * the phone uploads straight to storage (too big to pass through the app's
 * server), then the server checks the file and records time, place and flags.
 */
export async function uploadSiteVideo(taskId: string, file: File, capture: Capture): Promise<TaskAttachment> {
    const url = `/api/tasks/${encodeURIComponent(taskId)}/evidence/video`;
    const post = async (payload: Record<string, unknown>) => {
        const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
        const body = await res.json().catch(() => null);
        if (!res.ok)
            throw new Error(body?.error ?? "The video didn't save. Check your signal and try again.");
        return body;
    };
    const { path, token } = await post({ step: "start", type: file.type, size: file.size });
    const { error } = await createBrowserClient().storage.from(TASK_BUCKET).uploadToSignedUrl(path, token, file, { contentType: file.type.split(";")[0] });
    if (error)
        throw new Error("The video didn't upload. Check your signal and try again.");
    return await post({ step: "finish", path, takenAt: capture.takenAt, deviceNow: Date.now(), lat: capture.fix?.lat, lng: capture.fix?.lng, accuracy: capture.fix?.accuracy }) as TaskAttachment;
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
export type { MediaKind };
