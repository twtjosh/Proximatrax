import type { SupabaseClient } from "@supabase/supabase-js";
import { mediaKindFromMime, type MediaKind } from "@/lib/media-kind";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { ChatMessageAttachment } from "@/types/database";
const CHAT_BUCKET = "project-chat";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export function publicAttachmentUrl(storagePath: string): string {
    const base = process.env.NEXT_PUBLIC_SUPABASE_URL;
    if (!base)
        return storagePath;
    return `${base}/storage/v1/object/public/${CHAT_BUCKET}/${storagePath}`;
}
export async function listProjectChatAttachments(projectId: string, client?: SupabaseClient): Promise<ChatMessageAttachment[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("chat_message_attachments")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
    if (error)
        throw error;
    return (data ?? []) as ChatMessageAttachment[];
}
export async function uploadChatAttachment(projectId: string, file: File, options?: {
    caption?: string;
    client?: SupabaseClient;
}): Promise<{
    messageId: string;
    attachment: ChatMessageAttachment;
}> {
    const sb = resolveClient(options?.client);
    const { data: { user }, } = await sb.auth.getUser();
    if (!user)
        throw new Error("Not authenticated.");
    const caption = options?.caption?.trim() || file.name;
    const mimeType = file.type || "application/octet-stream";
    const mediaKind = mediaKindFromMime(mimeType);
    const { data: message, error: messageError } = await sb
        .from("chat_messages")
        .insert({
        project_id: projectId,
        sender_id: user.id,
        content: caption,
    })
        .select("*")
        .single();
    if (messageError)
        throw messageError;
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
    const storagePath = `${projectId}/${message.id}/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage
        .from(CHAT_BUCKET)
        .upload(storagePath, file, {
        cacheControl: "3600",
        upsert: false,
        contentType: mimeType,
    });
    if (uploadError) {
        await sb.from("chat_messages").delete().eq("id", message.id);
        throw uploadError;
    }
    const { data: attachment, error: attachmentError } = await sb
        .from("chat_message_attachments")
        .insert({
        message_id: message.id,
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
            message_id: message.id,
        },
    });
    return {
        messageId: message.id,
        attachment: attachment as ChatMessageAttachment,
    };
}
export function filterAttachmentsByKind(items: ChatMessageAttachment[], kind: MediaKind | "all"): ChatMessageAttachment[] {
    if (kind === "all")
        return items;
    return items.filter((item) => item.media_kind === kind);
}
