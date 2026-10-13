import { notFound, redirect } from "next/navigation";
import { PmInspectionQueue } from "@/components/dashboard/pm-inspection-queue";
import { projectBoardPath, ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listTasksForProject } from "@/services/task-service";

/** The PM's review queue. Phase 2 turns it into the focused review mode. */
export default async function ProjectReviewPage(props: { params: Promise<{ id: string }> }) {
    const { id } = await props.params;
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
    return (<div className="pt-2">
      <PmInspectionQueue projectId={id} initialTasks={tasks} initialAttachments={attachments}/>
    </div>);
}
