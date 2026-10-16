import { redirect } from "next/navigation";
import { NewProjectForm } from "@/components/projects/new/new-project-form";
import type { PersonOption } from "@/components/projects/new/person-picker";
import { ROUTES } from "@/lib/constants";
import { isoDateIn } from "@/lib/dashboard";
import { clientContext, crewContext } from "@/lib/new-project";
import { getViewer } from "@/lib/supabase/server";
import { throwIfSupabaseError } from "@/lib/utils";
import type { Profile } from "@/types/database";

type PersonRow = Pick<Profile, "id" | "full_name" | "role" | "avatar_url">;
const none = { data: [], error: null };

/**
 * Only a project manager opens projects. The pickers say how each person
 * relates to this PM, from the projects RLS lets them read.
 */
export default async function NewProjectPage() {
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const me = profile as Profile | null;
    if (!me || me.role !== "project_manager")
        redirect(me?.role === "super_admin" ? ROUTES.DASHBOARD : ROUTES.PROJECTS);

    const [peopleRes, projectsRes] = await Promise.all([
        supabase.from("profiles").select("id, full_name, role, avatar_url").in("role", ["client", "middleman"]).order("full_name"),
        supabase.from("projects").select("id, client_id, status").eq("pm_id", me.id),
    ]);
    throwIfSupabaseError(peopleRes.error);
    throwIfSupabaseError(projectsRes.error);
    const people = (peopleRes.data ?? []) as PersonRow[];
    const projects = (projectsRes.data ?? []) as { id: string; client_id: string; status: string }[];
    const ids = projects.map((p) => p.id);
    const [membersRes, invitesRes] = ids.length > 0
        ? await Promise.all([
            supabase.from("project_members").select("project_id, user_id").in("project_id", ids),
            supabase.from("project_invitations").select("project_id, invitee_id").in("project_id", ids).eq("status", "pending").eq("invitee_role", "middleman"),
        ])
        : [none, none];
    throwIfSupabaseError(membersRes.error);
    throwIfSupabaseError(invitesRes.error);
    const members = (membersRes.data ?? []) as { project_id: string; user_id: string }[];
    const invites = (invitesRes.data ?? []) as { project_id: string; invitee_id: string }[];

    const option = (p: PersonRow, context: string): PersonOption => ({ id: p.id, name: p.full_name, avatarUrl: p.avatar_url, context });
    return (<NewProjectForm today={isoDateIn(new Date())} clients={people.filter((p) => p.role === "client").map((p) => option(p, clientContext(p.id, projects)))} middlemen={people.filter((p) => p.role === "middleman").map((p) => option(p, crewContext(p.id, projects, members, invites)))}/>);
}
