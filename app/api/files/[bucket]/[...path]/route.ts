import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

/** Which tables record the files of each bucket. A file is served only if its row is visible to the viewer. */
const RECORDS: Record<string, string[]> = {
    "project-tasks": ["task_attachments", "project_files"],
    "project-chat": ["chat_message_attachments"],
};
const LINK_SECONDS = 300;
const NOT_FOUND = () => NextResponse.json({ error: "Not found" }, { status: 404 });

/**
 * Sends a signed-in viewer to a short-lived link for a stored file. Row-level
 * security decides: the row is read as the viewer, so a client only reaches
 * approved photos and shared documents. Only then does the service role sign.
 */
export async function GET(request: Request) {
    const url = new URL(request.url);
    // The raw path, so a filename's encoding doesn't depend on how the framework decodes params.
    const [bucket, ...segments] = url.pathname.split("/").slice(3);
    const tables = Object.hasOwn(RECORDS, bucket) ? RECORDS[bucket] : null;
    if (!tables || segments.length === 0)
        return NOT_FOUND();
    let storagePath: string;
    try {
        storagePath = segments.map(decodeURIComponent).join("/");
    }
    catch {
        return NOT_FOUND();
    }
    const supabase = await createClient();
    const { data: claims } = await supabase.auth.getClaims();
    if (!claims?.claims.sub)
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    const rows = await Promise.all(tables.map((table) => supabase.from(table).select("id").eq("storage_path", storagePath).limit(1).maybeSingle()));
    if (!rows.some((r) => r.data))
        return NOT_FOUND();
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey)
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    const admin = createAdminClient(supabaseUrl, serviceRoleKey, { auth: { autoRefreshToken: false, persistSession: false } });
    const download = url.searchParams.get("download");
    const { data, error } = await admin.storage.from(bucket).createSignedUrl(storagePath, LINK_SECONDS, download ? { download } : undefined);
    if (error || !data)
        return NOT_FOUND();
    const response = NextResponse.redirect(data.signedUrl, 302);
    // Shorter than the link's life, so a cached redirect never points at an expired link.
    response.headers.set("Cache-Control", "private, max-age=120");
    return response;
}
