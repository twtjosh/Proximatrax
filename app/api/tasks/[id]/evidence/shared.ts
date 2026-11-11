import { NextResponse } from "next/server";
import { createClient as createAdminClient, type SupabaseClient } from "@supabase/supabase-js";
import { assessEvidence, type Fix, type Site } from "@/lib/evidence";
import { createClient } from "@/lib/supabase/server";

export const TASK_BUCKET = "project-tasks";
const OPEN_STAGES = ["backlog", "to_do", "in_progress"];
export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

export type EvidenceContext = { userId: string; task: { id: string; project_id: string }; site: Site; admin: SupabaseClient };

/**
 * Who is adding evidence to which task, checked as the viewer so row-level
 * security decides what they may touch. Only then is the service role made.
 */
export async function evidenceContext(taskId: string): Promise<EvidenceContext | NextResponse> {
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    const userId = claims?.claims.sub;
    if (!userId)
        return fail(401, "Unauthorized");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", userId).maybeSingle();
    if (!profile || profile.role === "client")
        return fail(403, "Clients can't add site photos.");
    const { data: task } = await supabase.from("tasks").select("id, project_id, stage").eq("id", taskId).maybeSingle();
    if (!task)
        return fail(404, "Task not found.");
    if (!OPEN_STAGES.includes(task.stage))
        return fail(409, "This task is already in review or done.");
    const { data: project } = await supabase.from("projects").select("status, site_latitude, site_longitude").eq("id", task.project_id).maybeSingle();
    if (!project)
        return fail(404, "Task not found.");
    if (project.status === "completed")
        return fail(409, "This engagement is formally closed and read-only.");
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey)
        return fail(500, "Server configuration error");
    return {
        userId,
        task: { id: task.id, project_id: task.project_id },
        site: project.site_latitude != null && project.site_longitude != null ? { lat: project.site_latitude, lng: project.site_longitude } : null,
        admin: createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } }),
    };
}

/** The phone's clock readings from a form or JSON body; null when either is missing. */
export function clockReadings(takenAt: unknown, deviceNow: unknown): { deviceTakenAt: number; deviceNow: number } | null {
    if (takenAt === null || takenAt === undefined || takenAt === "" || deviceNow === null || deviceNow === undefined || deviceNow === "")
        return null;
    const a = Number(takenAt), b = Number(deviceNow);
    return Number.isFinite(a) && Number.isFinite(b) ? { deviceTakenAt: a, deviceNow: b } : null;
}

/**
 * Judges a stored file against the server's clock and the site pin, writes
 * its row and the activity entry. The stored object is removed if the row
 * can't be written, so nothing is left without a record.
 */
export async function recordEvidence(ctx: EvidenceContext, file: { storagePath: string; fileName: string; mimeType: string; size: number; mediaKind: "photo" | "video" }, clock: { serverNow: number; deviceTakenAt: number; deviceNow: number }, fix: Fix): Promise<NextResponse> {
    const verdict = assessEvidence({ ...clock, fix, site: ctx.site });
    const { data: row, error } = await ctx.admin.from("task_attachments").insert({
        task_id: ctx.task.id,
        project_id: ctx.task.project_id,
        storage_path: file.storagePath,
        file_name: file.fileName,
        mime_type: file.mimeType,
        byte_size: file.size,
        media_kind: file.mediaKind,
        uploaded_by: ctx.userId,
        verified_capture: true,
        taken_at: verdict.takenAt,
        latitude: fix?.lat ?? null,
        longitude: fix?.lng ?? null,
        accuracy_m: fix?.accuracy ?? null,
        site_distance_m: verdict.distanceM,
        evidence_flags: verdict.flags,
    }).select("*").single();
    if (error || !row) {
        await ctx.admin.storage.from(TASK_BUCKET).remove([file.storagePath]);
        return fail(502, `The ${file.mediaKind} didn't save. Check your signal and try again.`);
    }
    await ctx.admin.from("activity_feed").insert({
        project_id: ctx.task.project_id,
        user_id: ctx.userId,
        action_type: "file_uploaded",
        details: { file_name: row.file_name, media_kind: file.mediaKind, task_id: ctx.task.id, source: "verified_camera" },
    });
    return NextResponse.json(row, { status: 201 });
}
