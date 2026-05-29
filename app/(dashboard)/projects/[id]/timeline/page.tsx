import { notFound, redirect } from "next/navigation";
import { ProjectTimelineView } from "@/components/dashboard/project-timeline-view";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
export default async function ProjectTimelinePage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const role = (profile as Pick<Profile, "role"> | null)?.role as UserRole | undefined;
    if (!role)
        redirect(ROUTES.LOGIN);
    const project = await getProjectById(id, supabase, { withMilestones: true });
    if (!project)
        notFound();
    const milestones = project.milestones ?? [];
    return (<ProjectTimelineView projectId={id} projectStart={project.start_date} projectEnd={project.end_date} milestones={milestones} viewerRole={role}/>);
}
