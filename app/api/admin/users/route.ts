import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/enums";
const PROVISIONABLE_ROLES: UserRole[] = [
    "project_manager",
    "middleman",
    "client",
];
type Body = {
    email?: string;
    password?: string;
    fullName?: string;
    role?: string;
    contactNumber?: string;
};
export async function POST(request: Request) {
    const supabase = await createServerClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const callerRole = (profile as {
        role?: string;
    } | null)?.role;
    if (callerRole !== "super_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let body: Body;
    try {
        body = (await request.json()) as Body;
    }
    catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const email = body.email?.trim().toLowerCase();
    const password = body.password;
    const fullName = body.fullName?.trim();
    const role = body.role as UserRole | undefined;
    const contactNumber = body.contactNumber?.trim() || null;
    if (!email || !password || !fullName || !role) {
        return NextResponse.json({ error: "email, password, fullName, and role are required" }, { status: 400 });
    }
    if (password.length < 8) {
        return NextResponse.json({ error: "Password must be at least 8 characters" }, { status: 400 });
    }
    if (!PROVISIONABLE_ROLES.includes(role)) {
        return NextResponse.json({ error: "Invalid role. SuperAdmin accounts cannot be provisioned here." }, { status: 400 });
    }
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const adminClient = createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
    const { data: created, error: createError } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        user_metadata: {
            full_name: fullName,
            role,
        },
    });
    if (createError || !created.user) {
        return NextResponse.json({ error: createError?.message ?? "Unable to create user" }, { status: 400 });
    }
    const { error: upsertError } = await adminClient
        .from("profiles")
        .upsert({
        id: created.user.id,
        full_name: fullName,
        role,
        contact_number: contactNumber,
    }, { onConflict: "id" });
    if (upsertError) {
        await adminClient.auth.admin.deleteUser(created.user.id).catch(() => { });
        return NextResponse.json({ error: `Profile write failed: ${upsertError.message}` }, { status: 500 });
    }
    return NextResponse.json({ success: true, userId: created.user.id }, { status: 201 });
}
