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
export async function DELETE(request: Request, context: {
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
    // Optional body: { reassignTo } hands the user's managed projects to another PM before deleting.
    const { reassignTo } = (await request.json().catch(() => ({}))) as {
        reassignTo?: string;
    };
    const { data: linkedProjects, error: projectsError } = await adminClient
        .from("projects")
        .select("id, title, pm_id, client_id")
        .or(`pm_id.eq.${userId},client_id.eq.${userId}`);
    if (projectsError) {
        return NextResponse.json({ error: projectsError.message }, { status: 500 });
    }
    const linked = (linkedProjects ?? []) as {
        title: string;
        pm_id: string;
        client_id: string;
    }[];
    const listTitles = (list: typeof linked) => list.slice(0, 3).map((p) => p.title).join(", ") +
        (list.length > 3 ? ` and ${list.length - 3} more` : "");
    const clientProjects = linked.filter((p) => p.client_id === userId);
    if (clientProjects.length > 0) {
        return NextResponse.json({
            error: `This user is the client on active project(s): ${listTitles(clientProjects)}. Remove those projects first.`,
        }, { status: 409 });
    }
    const managedProjects = linked.filter((p) => p.pm_id === userId);
    if (managedProjects.length > 0) {
        if (!reassignTo) {
            return NextResponse.json({
                error: `This user manages ${managedProjects.length} project(s): ${listTitles(managedProjects)}. Pick another project manager to take them over.`,
                reassignable: true,
            }, { status: 409 });
        }
        if (reassignTo === userId) {
            return NextResponse.json({ error: "Pick a different project manager." }, { status: 400 });
        }
        const { data: newPm } = await adminClient
            .from("profiles")
            .select("role")
            .eq("id", reassignTo)
            .maybeSingle();
        if ((newPm as {
            role?: string;
        } | null)?.role !== "project_manager") {
            return NextResponse.json({ error: "Projects can only be handed to a project manager." }, { status: 400 });
        }
        const { error: reassignError } = await adminClient
            .from("projects")
            .update({ pm_id: reassignTo })
            .eq("pm_id", userId);
        if (reassignError) {
            return NextResponse.json({ error: reassignError.message }, { status: 500 });
        }
    }
    const { error: deleteError } = await adminClient.auth.admin.deleteUser(userId);
    if (deleteError) {
        return NextResponse.json({ error: deleteError.message ?? "Unable to delete user." }, { status: 400 });
    }
    return NextResponse.json({ success: true });
}
