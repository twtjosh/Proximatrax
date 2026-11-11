import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { MAX_EVIDENCE_BYTES, validFix } from "@/lib/evidence";
import { clockReadings, evidenceContext, fail, recordEvidence, TASK_BUCKET } from "./shared";

/**
 * The one way a middleman's site photo gets in. The viewer, task and project
 * are checked as the viewer; the server's clock and the project's site pin
 * then judge the photo, and only after that does the service role store it.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const serverNow = Date.now();
    const ctx = await evidenceContext((await params).id);
    if (ctx instanceof NextResponse)
        return ctx;

    let form: FormData;
    try {
        form = await request.formData();
    }
    catch {
        return fail(413, "Photo is too large. Take it again.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || file.type !== "image/jpeg")
        return fail(415, "Only camera photos can be added here.");
    if (file.size > MAX_EVIDENCE_BYTES)
        return fail(413, "Photo is too large. Take it again.");
    const clock = clockReadings(form.get("takenAt"), form.get("deviceNow"));
    if (!clock)
        return fail(400, "The photo's capture time is missing. Take it again.");

    const storagePath = `${ctx.task.project_id}/${ctx.task.id}/${randomUUID()}-site-photo.jpg`;
    const { error } = await ctx.admin.storage.from(TASK_BUCKET).upload(storagePath, file, { cacheControl: "3600", upsert: false, contentType: "image/jpeg" });
    if (error)
        return fail(502, "The photo didn't save. Check your signal and try again.");
    return recordEvidence(ctx, { storagePath, fileName: file.name || "site-photo.jpg", mimeType: "image/jpeg", size: file.size, mediaKind: "photo" }, { serverNow, ...clock }, validFix(form.get("lat"), form.get("lng"), form.get("accuracy")));
}
