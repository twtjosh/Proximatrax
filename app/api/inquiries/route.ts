import { revalidateInquiryDashboardPaths } from "@/lib/revalidate-inquiry-dashboard";
import { parseInquiry } from "@/lib/inquiry-input";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

/** At most this many inquiries from one address, or one client IP, per window. */
const LIMIT = 3, WINDOW_MS = 10 * 60_000;
// ponytail: per-instance memory, so each serverless instance counts on its own; move to a shared store (or an ip column) if spam gets through.
const recent = new Map<string, number[]>();
function tooMany(key: string, now: number) {
    const hits = (recent.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
    recent.set(key, [...hits, now]);
    return hits.length >= LIMIT;
}

export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const body = await request.json().catch(() => null);
    const parsed = parseInquiry(body);
    if (!parsed.ok) {
        return NextResponse.json({ error: parsed.error }, { status: 400 });
    }
    const { name, email, message } = parsed.value;
    const ip = request.headers.get("x-real-ip") ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
    if (tooMany(`ip:${ip}`, Date.now())) {
        return NextResponse.json({ error: "Too many inquiries. Please wait a few minutes and try again." }, { status: 429 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        // Shared across instances: the table itself says how often this address wrote lately.
        const { count, error: countError } = await supabase
            .from("inquiries")
            .select("id", { count: "exact", head: true })
            .eq("email", email)
            .gte("created_at", new Date(Date.now() - WINDOW_MS).toISOString());
        if (countError)
            throw countError;
        if ((count ?? 0) >= LIMIT) {
            return NextResponse.json({ error: "Too many inquiries. Please wait a few minutes and try again." }, { status: 429 });
        }
        const { data, error } = await supabase
            .from("inquiries")
            .insert({ name, email, message })
            .select("id, created_at")
            .single();
        if (error)
            throw error;
        revalidateInquiryDashboardPaths();
        return NextResponse.json({ success: true, id: data.id }, { status: 201 });
    }
    catch {
        return NextResponse.json({ error: "Unable to submit inquiry. Please try again." }, { status: 500 });
    }
}
