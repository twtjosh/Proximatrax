import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { createProjectInvitations } from "@/services/project-invitation-service";
import { createProject, deleteProject, seedDefaultMilestones, } from "@/services/project-service";
type Body = {
    title?: string;
    description?: string | null;
    clientId?: string;
    middlemanId?: string;
    startDate?: string;
    endDate?: string;
    useTemplate?: boolean;
};
export async function POST(request: Request) {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    if ((profile as {
        role?: string;
    } | null)?.role !== "project_manager") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }
    let body: Body;
    try {
        body = (await request.json()) as Body;
    }
    catch {
        return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }
    const title = body.title?.trim();
    const clientId = body.clientId?.trim();
    const middlemanId = body.middlemanId?.trim();
    const startDate = body.startDate?.trim();
    const endDate = body.endDate?.trim();
    const description = body.description?.trim() || null;
    const useTemplate = body.useTemplate !== false;
    if (!title || !clientId || !middlemanId || !startDate || !endDate) {
        return NextResponse.json({
            error: "title, clientId, middlemanId, startDate, and endDate are required",
        }, { status: 400 });
    }
    if (clientId === middlemanId) {
        return NextResponse.json({ error: "Client and middleman must be different people." }, { status: 400 });
    }
    let projectId: string | null = null;
    try {
        const project = await createProject({
            title,
            description,
            pm_id: user.id,
            client_id: clientId,
            start_date: startDate,
            end_date: endDate,
            status: "pending_invites",
        }, supabase);
        projectId = project.id;
        await createProjectInvitations([
            {
                project_id: project.id,
                invitee_id: clientId,
                invitee_role: "client",
                invited_by: user.id,
                project_title: project.title,
            },
            {
                project_id: project.id,
                invitee_id: middlemanId,
                invitee_role: "middleman",
                invited_by: user.id,
                project_title: project.title,
            },
        ], supabase);
        if (useTemplate) {
            await seedDefaultMilestones(project.id, project.start_date, project.end_date, supabase);
        }
        try {
            await logActivity({
                project_id: project.id,
                action_type: "project_created",
                details: { title: project.title, invitations: "pending" },
            }, supabase);
        }
        catch {
        }
        return NextResponse.json({ success: true, projectId: project.id });
    }
    catch (error) {
        if (projectId) {
            await deleteProject(projectId, supabase).catch(() => { });
        }
        return NextResponse.json({ error: getErrorMessage(error) }, { status: 400 });
    }
}
