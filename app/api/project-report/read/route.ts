import { NextResponse } from "next/server";
import { generateJson } from "@/lib/gemini";
import { isoDateIn } from "@/lib/dashboard";
import { MAX_REPORT_UPLOAD_BYTES, matchReadIntake, READ_SCHEMA, readPrompt, REPORT_UPLOAD_TYPES } from "@/lib/project-intake";
import { aiFail, fail, people, pmOnly } from "../shared";

export const maxDuration = 60;

/** A printed report, filled in and scanned or photographed, read back into the form for the PM to check. */
export async function POST(request: Request) {
    const ctx = await pmOnly();
    if (ctx instanceof NextResponse)
        return ctx;
    let form: FormData;
    try {
        form = await request.formData();
    }
    catch {
        return fail(413, "That file is too large. Use one under 4 MB.");
    }
    const file = form.get("file");
    if (!(file instanceof File) || !REPORT_UPLOAD_TYPES.includes(file.type))
        return fail(415, "Upload the report as a PDF, JPG or PNG.");
    if (file.size > MAX_REPORT_UPLOAD_BYTES)
        return fail(413, "That file is too large. Use one under 4 MB.");
    try {
        const data = Buffer.from(await file.arrayBuffer()).toString("base64");
        const read = await generateJson([{ inline_data: { mime_type: file.type, data } }, { text: readPrompt() }], READ_SCHEMA);
        const { clients, crew } = await people(ctx.supabase);
        return NextResponse.json(matchReadIntake(read, clients, crew, isoDateIn(new Date())));
    }
    catch (e) {
        return aiFail(e);
    }
}
