import { NextResponse } from "next/server";
import { createClient as createAdminClient } from "@supabase/supabase-js";
import { createClient as createServerClient } from "@/lib/supabase/server";
import type { UserRole } from "@/types/enums";
const DELETABLE_ROLES: UserRole[] = ["project_manager", "middleman", "client"];
function getAdminClient() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceRoleKey) {
        return null;
    }
    return createAdminClient(supabaseUrl, serviceRoleKey, {
        auth: { autoRefreshToken: false, persistSession: false },
    });
}
export async function DELETE(_request: Request, context: {
    params: Promise<{
        userId: string;
    }>;
}) {
    const { userId } = await context.params;
    const supabase = await createServerClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: callerProfile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    if ((callerProfile as {
        role?: string;
    } | null)?.role !== "super_admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    if (!userId || userId === user.id) {
        return NextResponse.json({ error: "You cannot delete your own account." }, { status: 400 });
    }
    const adminClient = getAdminClient();
    if (!adminClient) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const { data: targetProfile, error: profileError } = await adminClient
        .from("profiles")
        .select("id, role, full_name")
        .eq("id", userId)
        .maybeSingle();
    if (profileError) {
        return NextResponse.json({ error: profileError.message }, { status: 500 });
    }
    if (!targetProfile) {
        return NextResponse.json({ error: "User not found." }, { status: 404 });
    }
    const targetRole = (targetProfile as {
        role: UserRole;
    }).role;
    if (!DELETABLE_ROLES.includes(targetRole)) {
        return NextResponse.json({ error: "SuperAdmin accounts cannot be deleted from this panel." }, { status: 400 });
    }
    const { data: linkedProjects, error: projectsError } = await adminClient
        .from("projects")
        .select("id, title")
        .or(`pm_id.eq.${userId},client_id.eq.${userId}`);
    if (projectsError) {
        return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }
    if ((linkedProjects ?? []).length > 0) {
        const names = (linkedProjects ?? [])
            .slice(0, 3)
            .map((p) => (p as {
            title: string;
        }).title)
            .join(", ");
        const extra = (linkedProjects ?? []).length > 3
            ? ` and ${(linkedProjects ?? []).length - 3} more`
            : "";
        return NextResponse.json({
            error: `This user is assigned to active project(s): ${names}${extra}. Reassign or remove those projects first.`,
        }, { status: 409 });
    }
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
        return NextResponse.json({ error: deleteError.message ?? "Unable to delete user." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
}
