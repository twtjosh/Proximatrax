import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { isIssuedVideoPath, issuedVideoPath, validFix, videoExtension, videoTooBig } from "@/lib/evidence";
import { clockReadings, evidenceContext, fail, recordEvidence, TASK_BUCKET } from "../shared";

const TOO_BIG = "That video is too long to upload. Keep it under 30 seconds.";

/**
 * Site videos are too big for a request body here (Vercel stops at 4.5 MB),
 * so they go in two steps. "start": the server checks the task and hands back
 * a one-time upload link for a path it chose. "finish": the server checks
 * that exactly that path now holds a video, then judges and records it like a
 * photo, using its own clock.
 */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
    const serverNow = Date.now();
    const ctx = await evidenceContext((await params).id);
    if (ctx instanceof NextResponse)
        return ctx;
    const body = await request.json().catch(() => null) as Record<string, unknown> | null;
    if (!body)
        return fail(400, "Bad request");

    if (body.step === "start") {
        const ext = videoExtension(String(body.type ?? ""));
        if (!ext)
            return fail(415, "Only videos recorded in the app can be added here.");
        if (videoTooBig(Number(body.size) || 0))
            return fail(413, TOO_BIG);
        // ponytail: a "start" never finished leaves its file in storage; sweep unrecorded *-site-video.* objects if it piles up.
        const { data, error } = await ctx.admin.storage.from(TASK_BUCKET).createSignedUploadUrl(issuedVideoPath(ctx.task.project_id, ctx.task.id, randomUUID(), ext));
        if (error || !data)
            return fail(502, "The video didn't save. Check your signal and try again.");
        return NextResponse.json({ path: data.path, token: data.token });
    }

    if (body.step === "finish") {
        const path = String(body.path ?? "");
        if (!isIssuedVideoPath(path, ctx.task.project_id, ctx.task.id))
            return fail(400, "Bad request");
        const clock = clockReadings(body.takenAt, body.deviceNow);
        if (!clock)
            return fail(400, "The video's capture time is missing. Record it again.");
        const { data: existing } = await ctx.admin.from("task_attachments").select("id").eq("storage_path", path).maybeSingle();
        if (existing)
            return fail(409, "This video is already on the task.");
        const { data: info, error } = await ctx.admin.storage.from(TASK_BUCKET).info(path);
        if (error || !info)
            return fail(400, "The video didn't upload. Check your signal and try again.");
        const type = info.contentType ?? "";
        const size = info.size ?? 0;
        if (!videoExtension(type) || videoTooBig(size)) {
            await ctx.admin.storage.from(TASK_BUCKET).remove([path]);
            return fail(415, "Only videos recorded in the app can be added here.");
        }
        return recordEvidence(ctx, { storagePath: path, fileName: `site-video.${videoExtension(type)}`, mimeType: type.split(";")[0], size, mediaKind: "video" }, { serverNow, ...clock }, validFix(body.lat, body.lng, body.accuracy));
    }

    return fail(400, "Bad request");
}
