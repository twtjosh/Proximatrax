import { notFound, redirect } from "next/navigation";
import { PmTimeline } from "@/components/projects/pm/schedule/pm-timeline";
import { projectPath, ROUTES } from "@/lib/constants";
import { CrewSchedule } from "@/components/projects/crew/crew-schedule";
import { loadCrewProject } from "@/lib/data/crew-project";
import { isoDateIn } from "@/lib/dashboard";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById, listMilestones, listProjectAssignees } from "@/services/project-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { countTaskComments } from "@/services/task-comment-service";
import { listTasksForProject } from "@/services/task-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
export default async function ProjectTimelinePage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const role = (profile as Pick<Profile, "role"> | null)?.role as UserRole | undefined;
    if (!role)
        redirect(ROUTES.LOGIN);
    if (role === "middleman") {
        const data = await loadCrewProject(supabase, id, user.id);
        if (!data)
            notFound();
        return <CrewSchedule data={data} viewerId={user.id}/>;
    }
    if (role !== "project_manager" && role !== "super_admin")
        redirect(projectPath(id));
    const [project, milestones, tasks, people, attachments, comments] = await Promise.all([
        getProjectById(id, supabase),
        listMilestones(id, supabase),
        listTasksForProject(id, supabase),
        listProjectAssignees(id, supabase),
        listTaskAttachmentsForProject(id, supabase),
        countTaskComments(id, supabase),
    ]);
    if (!project)
        notFound();
    return <PmTimeline projectId={id} start={project.start_date} end={project.end_date} milestones={milestones} tasks={tasks} attachments={attachments} comments={comments} people={people} today={isoDateIn(new Date())} viewerId={user.id} closed={project.status === "completed" || role === "super_admin"}/>;
}
