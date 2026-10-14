import { notFound, redirect } from "next/navigation";
import { PmSchedule } from "@/components/projects/pm/schedule/pm-schedule";
import { projectPath, ROUTES } from "@/lib/constants";
import { CrewSchedule } from "@/components/projects/crew/crew-schedule";
import { loadCrewProject } from "@/lib/data/crew-project";
import { isoDateIn } from "@/lib/dashboard";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById, listMilestones, listProjectAssignees } from "@/services/project-service";
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
    if (role !== "project_manager")
        redirect(projectPath(id));
    const [project, milestones, tasks, people] = await Promise.all([
        getProjectById(id, supabase),
        listMilestones(id, supabase),
        listTasksForProject(id, supabase),
        listProjectAssignees(id, supabase),
    ]);
    if (!project)
        notFound();
    return <PmSchedule projectId={id} start={project.start_date} end={project.end_date} milestones={milestones} tasks={tasks} people={people} today={isoDateIn(new Date())} closed={project.status === "completed"}/>;
}
