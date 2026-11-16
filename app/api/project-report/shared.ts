import { NextResponse } from "next/server";
import type { SupabaseClient, User } from "@supabase/supabase-js";
import type { CrewRole, TeamMember } from "@/lib/auto-plan";
import { AiBusyError } from "@/lib/gemini";
import { createClient } from "@/lib/supabase/server";

export const fail = (status: number, error: string) => NextResponse.json({ error }, { status });

/** Only a signed-in project manager drafts plans; Gemini's free quota is shared, so nobody else spends it. */
export async function pmOnly(): Promise<{ supabase: SupabaseClient; user: User } | NextResponse> {
    const supabase = await createClient();
    const { data: { user } } = await supabase.auth.getUser();
    if (!user)
        return fail(401, "Unauthorized");
    const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
    if ((profile as { role?: string } | null)?.role !== "project_manager")
        return fail(403, "Forbidden");
    return { supabase, user };
}

export function aiFail(e: unknown): NextResponse {
    if (e instanceof AiBusyError)
        return fail(503, e.message);
    console.error("[project-report]", e);
    return fail(500, "The plan could not be made. Try again, or tell the administrator if it keeps happening.");
}

type PersonRow = { id: string; full_name: string; role: string; classification: CrewRole | null };

/** Clients and crew the PM can choose from, by name (for reading a scan) and by id (for checking a request). */
export async function people(supabase: SupabaseClient) {
    const { data, error } = await supabase.from("profiles").select("id, full_name, role, classification").in("role", ["client", "middleman"]);
    if (error)
        throw error;
    const rows = (data ?? []) as PersonRow[];
    const clients = rows.filter((p) => p.role === "client").map((p) => ({ id: p.id, name: p.full_name }));
    const crew: TeamMember[] = rows.filter((p) => p.role === "middleman").map((p) => ({ id: p.id, name: p.full_name, role: p.classification }));
    return { clients, crew };
}

export async function readJson<T>(request: Request): Promise<T | null> {
    try {
        const body = await request.json();
        return body && typeof body === "object" ? (body as T) : null;
    }
    catch {
        return null;
    }
}
