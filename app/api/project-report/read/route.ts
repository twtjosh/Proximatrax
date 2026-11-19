import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { filePart, generateJson } from "@/lib/gemini";
import { isoDateIn } from "@/lib/dashboard";
import { MAX_REPORT_UPLOAD_BYTES, matchReadIntake, READ_SCHEMA, readPrompt, REPORT_UPLOAD_TYPES } from "@/lib/project-intake";
import { aiFail, fail, people, pmOnly, readJson } from "../shared";

export const maxDuration = 60;

const BUCKET = "project-tasks";
const TOO_BIG = `That file is over ${MAX_REPORT_UPLOAD_BYTES / 1024 / 1024} MB. Save it smaller and try again.`;
const EXT: Record<string, string> = { "application/pdf": "pdf", "image/jpeg": "jpg", "image/png": "png", "text/csv": "csv" };

/**
 * Any project document (PDF or photo) read into the report form for the PM
 * to check; the team is left to them. Files are bigger than a request body
 * here allows (Vercel stops at 4.5 MB), so it goes in two steps. "start":
 * a one-time upload link for a path the server chose, under the PM's own
 * folder. "read": the server takes that file, deletes it from storage, and
 * has Gemini read it.
 */
export async function POST(request: Request) {
    const ctx = await pmOnly();
    if (ctx instanceof NextResponse)
        return ctx;
    const body = await readJson<{ step?: string; type?: string; size?: number; path?: string }>(request);
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL, key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!body)
        return fail(400, "Bad request");
    if (!url || !key)
        return fail(500, "Server configuration error");
    const admin = createAdminClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
    const folder = `reports/${ctx.user.id}/`;

    if (body.step === "start") {
        const ext = EXT[String(body.type)];
        if (!ext)
            return fail(415, "Upload the report as a PDF, JPG, PNG or the CSV template.");
        if ((Number(body.size) || 0) > MAX_REPORT_UPLOAD_BYTES)
            return fail(413, TOO_BIG);
        // ponytail: a "start" never read leaves its file in storage; sweep reports/ if it piles up.
        const { data, error } = await admin.storage.from(BUCKET).createSignedUploadUrl(`${folder}${randomUUID()}.${ext}`);
        if (error || !data)
            return fail(502, "The file could not be uploaded. Check your connection and try again.");
        return NextResponse.json({ path: data.path, token: data.token });
    }

    if (body.step === "read") {
        const path = String(body.path ?? "");
        if (!path.startsWith(folder) || path.includes(".."))
            return fail(400, "Bad request");
        const { data: blob, error } = await admin.storage.from(BUCKET).download(path);
        // The report only passes through: it is never kept in storage.
        await admin.storage.from(BUCKET).remove([path]);
        if (error || !blob)
            return fail(400, "The file didn't upload. Try again.");
        const type = blob.type.split(";")[0];
        if (!REPORT_UPLOAD_TYPES.includes(type))
            return fail(415, "Upload the report as a PDF, JPG or PNG.");
        if (blob.size > MAX_REPORT_UPLOAD_BYTES)
            return fail(413, TOO_BIG);
        try {
            const { part, done } = await filePart(Buffer.from(await blob.arrayBuffer()), type);
            const today = isoDateIn(new Date());
            const read = await generateJson([part, { text: readPrompt(today) }], READ_SCHEMA).finally(done);
            const { clients } = await people(ctx.supabase);
            return NextResponse.json(matchReadIntake(read, clients, today));
        }
        catch (e) {
            return aiFail(e);
        }
    }

    return fail(400, "Bad request");
}
