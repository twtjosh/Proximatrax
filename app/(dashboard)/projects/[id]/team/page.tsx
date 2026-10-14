import { notFound, redirect } from "next/navigation";
import { ProjectTeam } from "@/components/projects/pm/team/project-team";
import { projectPath, ROUTES } from "@/lib/constants";
import { loadPmProject } from "@/lib/data/pm-project";
import { getViewer } from "@/lib/supabase/server";
import { listInvitationsForProject } from "@/services/project-invitation-service";
import { listProfilesByRoles } from "@/services/project-service";

/** The PM's team: who is on the project, their load and contact, invitations. */
export default async function ProjectTeamPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    if (profile?.role !== "project_manager")
        redirect(projectPath(id));
    const data = await loadPmProject(supabase, id, user.id);
    if (!data)
        notFound();
    const [invitations, pool, contacts] = await Promise.all([
        listInvitationsForProject(id, supabase).catch(() => []),
        listProfilesByRoles(["middleman"], supabase).catch(() => []),
        supabase.from("profiles").select("id, contact_number").in("id", data.team.map((m) => m.id)),
    ]);
    const phones = Object.fromEntries(((contacts.data ?? []) as { id: string; contact_number: string | null }[]).filter((c) => c.contact_number).map((c) => [c.id, c.contact_number!]));
    return <ProjectTeam projectId={id} projectTitle={data.project.title} viewerId={user.id} team={data.team} contacts={phones} tasks={data.tasks} invitations={invitations} crewPool={pool.map((p) => ({ id: p.id, full_name: p.full_name, avatar_url: p.avatar_url }))} today={data.today} closed={data.project.status === "completed"}/>;
}
