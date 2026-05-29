import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import { throwIfSupabaseError } from "@/lib/utils";
import type { ProjectInvitation, ProjectInvitationWithInvitee, ProjectInvitationWithInviter, Profile, } from "@/types/database";
import type { ProjectInviteeRole } from "@/types/enums";
import { addProjectMember } from "./project-service";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export type CreateProjectInvitationInput = {
    project_id: string;
    invitee_id: string;
    invitee_role: ProjectInviteeRole;
    invited_by: string;
    project_title: string;
};
export async function createProjectInvitations(invitations: CreateProjectInvitationInput[], client?: SupabaseClient): Promise<ProjectInvitation[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("project_invitations")
        .insert(invitations.map((inv) => ({
        project_id: inv.project_id,
        invitee_id: inv.invitee_id,
        invitee_role: inv.invitee_role,
        invited_by: inv.invited_by,
        project_title: inv.project_title,
        status: "pending" as const,
    })))
        .select("*");
    throwIfSupabaseError(error);
    return (data ?? []) as ProjectInvitation[];
}
export async function listPendingInvitationsForUser(userId: string, client?: SupabaseClient): Promise<ProjectInvitationWithInviter[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("project_invitations")
        .select("*")
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .order("created_at", { ascending: false });
    throwIfSupabaseError(error);
    const rows = (data ?? []) as ProjectInvitation[];
    const inviterIds = [...new Set(rows.map((r) => r.invited_by))];
    if (inviterIds.length === 0) {
        return rows.map((r) => ({ ...r, inviter: null }));
    }
    const { data: inviters, error: inviterError } = await sb
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", inviterIds);
    if (inviterError)
        throw inviterError;
    const inviterMap = new Map((inviters ?? []).map((p) => [
        p.id,
        p as Pick<Profile, "id" | "full_name" | "avatar_url">,
    ]));
    return rows.map((row) => ({
        ...row,
        inviter: inviterMap.get(row.invited_by) ?? null,
    }));
}
export async function listInvitationsForProject(projectId: string, client?: SupabaseClient): Promise<ProjectInvitationWithInvitee[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("project_invitations")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: true });
    throwIfSupabaseError(error);
    const rows = (data ?? []) as ProjectInvitation[];
    const inviteeIds = [...new Set(rows.map((r) => r.invitee_id))];
    if (inviteeIds.length === 0) {
        return rows.map((r) => ({ ...r, invitee: null }));
    }
    const { data: invitees, error: inviteeError } = await sb
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .in("id", inviteeIds);
    if (inviteeError)
        throw inviteeError;
    const inviteeMap = new Map((invitees ?? []).map((p) => [
        p.id,
        p as Pick<Profile, "id" | "full_name" | "avatar_url" | "role">,
    ]));
    return rows.map((row) => ({
        ...row,
        invitee: inviteeMap.get(row.invitee_id) ?? null,
    }));
}
async function activateProjectIfReady(projectId: string, client: SupabaseClient): Promise<void> {
    const { error } = await client.rpc("activate_project_if_invites_accepted", {
        p_project_id: projectId,
    });
    throwIfSupabaseError(error);
}
export async function acceptProjectInvitation(invitationId: string, userId: string, client?: SupabaseClient): Promise<ProjectInvitation> {
    const sb = resolveClient(client);
    const { data: existing, error: fetchError } = await sb
        .from("project_invitations")
        .select("*")
        .eq("id", invitationId)
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .maybeSingle();
    if (fetchError)
        throw fetchError;
    if (!existing) {
        throw new Error("Invitation not found or already responded to.");
    }
    const invitation = existing as ProjectInvitation;
    if (invitation.invitee_role === "middleman") {
        await addProjectMember({
            project_id: invitation.project_id,
            user_id: userId,
            role_in_project: "middleman",
        }, sb);
    }
    const respondedAt = new Date().toISOString();
    const { data: updated, error: updateError } = await sb
        .from("project_invitations")
        .update({
        status: "accepted",
        responded_at: respondedAt,
    })
        .eq("id", invitationId)
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .select("*")
        .single();
    throwIfSupabaseError(updateError);
    await activateProjectIfReady(invitation.project_id, sb);
    return updated as ProjectInvitation;
}
export async function declineProjectInvitation(invitationId: string, userId: string, client?: SupabaseClient): Promise<ProjectInvitation> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("project_invitations")
        .update({
        status: "declined",
        responded_at: new Date().toISOString(),
    })
        .eq("id", invitationId)
        .eq("invitee_id", userId)
        .eq("status", "pending")
        .select("*")
        .single();
    throwIfSupabaseError(error);
    return data as ProjectInvitation;
}
