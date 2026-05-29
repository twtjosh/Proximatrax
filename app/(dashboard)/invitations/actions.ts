"use server";
import { revalidatePath } from "next/cache";
import { ROUTES, projectPath } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { acceptProjectInvitation, declineProjectInvitation, } from "@/services/project-invitation-service";
function revalidateInvitationPaths(projectId: string) {
    revalidatePath(ROUTES.DASHBOARD);
    revalidatePath(ROUTES.MIDDLEMAN_HOME);
    revalidatePath(ROUTES.PROJECTS);
    revalidatePath(projectPath(projectId));
}
export async function acceptProjectInvitationAction(invitationId: string) {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false as const, error: "Unauthorized" };
    }
    try {
        const invitation = await acceptProjectInvitation(invitationId, user.id, supabase);
        try {
            await logActivity({
                project_id: invitation.project_id,
                action_type: "member_added",
                details: {
                    role: invitation.invitee_role,
                    via: "invitation_accepted",
                },
            }, supabase);
        }
        catch {
        }
        revalidateInvitationPaths(invitation.project_id);
        return {
            ok: true as const,
            projectId: invitation.project_id,
            inviteeRole: invitation.invitee_role,
        };
    }
    catch (e) {
        return { ok: false as const, error: getErrorMessage(e) };
    }
}
export async function declineProjectInvitationAction(invitationId: string) {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false as const, error: "Unauthorized" };
    }
    try {
        const invitation = await declineProjectInvitation(invitationId, user.id, supabase);
        try {
            await logActivity({
                project_id: invitation.project_id,
                action_type: "status_changed",
                details: {
                    invitation: invitation.invitee_role,
                    status: "declined",
                },
            }, supabase);
        }
        catch {
        }
        revalidateInvitationPaths(invitation.project_id);
        return { ok: true as const };
    }
    catch (e) {
        return { ok: false as const, error: getErrorMessage(e) };
    }
}
