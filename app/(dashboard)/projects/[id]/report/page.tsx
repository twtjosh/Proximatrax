import { notFound, redirect } from "next/navigation";
import { ProjectReport } from "@/components/projects/pm/report/project-report";
import { projectPath, ROUTES } from "@/lib/constants";
import { loadPmProject } from "@/lib/data/pm-project";
import { getViewer } from "@/lib/supabase/server";
import { PROJECT_STATUS_TERMS } from "@/lib/vocabulary";
import { listProjectActivityPage } from "@/services/activity-service";
import { listTaskAttachmentsForProject, publicTaskAttachmentUrl } from "@/services/task-attachment-service";

/** The PM's printable project report. */
export default async function ProjectReportPage(props: {
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
    const [data, activity, attachments] = await Promise.all([
        loadPmProject(supabase, id, user.id),
        listProjectActivityPage(id, { limit: 10 }, supabase).catch(() => []),
        listTaskAttachmentsForProject(id, supabase).catch(() => []),
    ]);
    if (!data)
        notFound();
    const photos: Record<string, string[]> = {};
    for (const a of attachments) {
        if (a.media_kind === "photo")
            (photos[a.task_id] ??= []).push(publicTaskAttachmentUrl(a.storage_path));
    }
    const { project } = data;
    return <ProjectReport title={project.title} client={project.client?.full_name ?? "the client"} pm={data.team.find((m) => m.id === project.pm_id)?.name ?? "—"} start={project.start_date} end={project.end_date} status={PROJECT_STATUS_TERMS[project.status].label} milestones={data.milestones} tasks={data.tasks} team={data.team} update={data.update} activity={activity} photos={photos} today={data.today}/>;
}
