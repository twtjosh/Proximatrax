import { notFound, redirect } from "next/navigation";
import { ProjectActivity } from "@/components/projects/pm/activity/project-activity";
import { projectPath, ROUTES } from "@/lib/constants";
import { loadPmProject } from "@/lib/data/pm-project";
import { getViewer } from "@/lib/supabase/server";
import { listProjectActivityPage } from "@/services/activity-service";

/** The PM's project log. Other roles' Overviews already tell them what changed. */
export default async function ProjectActivityPage(props: {
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
    const [data, rows] = await Promise.all([
        loadPmProject(supabase, id, user.id),
        listProjectActivityPage(id, { limit: 40 }, supabase).catch(() => []),
    ]);
    if (!data)
        notFound();
    return <ProjectActivity projectId={id} initial={rows} team={data.team} update={data.update} today={data.today} closed={data.project.status === "completed"}/>;
}
