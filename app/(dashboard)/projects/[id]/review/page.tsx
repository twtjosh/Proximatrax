import { notFound, redirect } from "next/navigation";
import { ReviewMode } from "@/components/projects/pm/review/review-mode";
import { projectBoardPath, ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listTasksForProject } from "@/services/task-service";

/** The PM's review mode: every submission waiting on them, full screen over the project. */
export default async function ProjectReviewPage(props: { params: Promise<{ id: string }>; searchParams: Promise<{ task?: string }> }) {
    const [{ id }, { task }] = await Promise.all([props.params, props.searchParams]);
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    if (profile?.role !== "project_manager")
        redirect(projectBoardPath(id));
    const [project, tasks, attachments] = await Promise.all([
        getProjectById(id, supabase),
        listTasksForProject(id, supabase),
        listTaskAttachmentsForProject(id, supabase),
    ]);
    if (!project)
        notFound();
    return <ReviewMode projectId={id} tasks={tasks} attachments={attachments} viewerId={user.id} initialTask={task ?? null}/>;
}
