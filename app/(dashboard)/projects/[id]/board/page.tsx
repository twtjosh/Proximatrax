import { notFound, redirect } from "next/navigation";
import { PmBoard } from "@/components/projects/pm/board/pm-board";
import { UpdatesFeed } from "@/components/projects/client/updates-feed";
import { projectPath, ROUTES } from "@/lib/constants";
import { isoDateIn } from "@/lib/dashboard";
import { loadClientProject } from "@/lib/data/client-project";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById, listMilestones, listProjectAssignees } from "@/services/project-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { countTaskComments } from "@/services/task-comment-service";
import { listTasksForProject } from "@/services/task-service";
import type { Profile } from "@/types/database";

/** The PM's board; the client's Updates. Middlemen work from their Overview. */
export default async function ProjectBoardPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role === "middleman")
        redirect(projectPath(id));
    if (role === "client") {
        const data = await loadClientProject(supabase, id);
        if (!data)
            notFound();
        return <UpdatesFeed data={data}/>;
    }
    if (role !== "project_manager")
        redirect(ROUTES.DASHBOARD);
    const [project, tasks, attachments, milestones, people, comments] = await Promise.all([
        getProjectById(id, supabase),
        listTasksForProject(id, supabase),
        listTaskAttachmentsForProject(id, supabase),
        listMilestones(id, supabase),
        listProjectAssignees(id, supabase),
        countTaskComments(id, supabase),
    ]);
    if (!project)
        notFound();
    return <PmBoard projectId={id} tasks={tasks} attachments={attachments} comments={comments} milestones={milestones} people={people} projectStart={project.start_date} today={isoDateIn(new Date())} viewerId={user.id} closed={project.status === "completed"}/>;
}
