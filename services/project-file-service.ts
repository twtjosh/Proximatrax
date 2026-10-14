import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { throwIfSupabaseError } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import type { ProjectFile, ProjectFileFolder } from "@/types/database";

/** Project documents live beside task media, under `<project>/files/`. */
const BUCKET = "project-tasks";

function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}

/** Newest first. Empty (not an error) before migration 0024 has run. */
export async function listProjectFiles(projectId: string, client?: SupabaseClient): Promise<{ files: ProjectFile[]; missing: boolean }> {
    const sb = resolveClient(client);
    const { data, error } = await sb.from("project_files").select("*").eq("project_id", projectId).order("created_at", { ascending: false });
    if (error)
        return { files: [], missing: true };
    return { files: (data ?? []) as ProjectFile[], missing: false };
}

export async function uploadProjectFile(projectId: string, folder: ProjectFileFolder, file: File, client?: SupabaseClient): Promise<ProjectFile> {
    const sb = resolveClient(client);
    const { data: { user } } = await sb.auth.getUser();
    if (!user)
        throw new Error("Not signed in.");
    const mimeType = file.type || "application/octet-stream";
    const safeName = file.name.replace(/[^\w.\-() ]+/g, "_").slice(0, 120);
    const storagePath = `${projectId}/files/${crypto.randomUUID()}-${safeName}`;
    const { error: uploadError } = await sb.storage.from(BUCKET).upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: mimeType });
    if (uploadError)
        throw uploadError;
    const { data, error } = await sb
        .from("project_files")
        .insert({ project_id: projectId, folder, storage_path: storagePath, file_name: file.name, mime_type: mimeType, byte_size: file.size, uploaded_by: user.id })
        .select("*")
        .single();
    if (error) {
        await sb.storage.from(BUCKET).remove([storagePath]);
        throw error;
    }
    void logActivity({ project_id: projectId, action_type: "file_uploaded", details: { file_name: file.name, folder, source: "files" } }, sb).catch(() => undefined);
    return data as ProjectFile;
}

export async function updateProjectFile(id: string, patch: { folder?: ProjectFileFolder; shared_with_client_at?: string | null; file_name?: string }, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb.from("project_files").update(patch).eq("id", id);
    throwIfSupabaseError(error);
}

export async function deleteProjectFile(file: Pick<ProjectFile, "id" | "storage_path">, client?: SupabaseClient): Promise<void> {
    const sb = resolveClient(client);
    const { error } = await sb.from("project_files").delete().eq("id", file.id);
    throwIfSupabaseError(error);
    await sb.storage.from(BUCKET).remove([file.storage_path]);
}
