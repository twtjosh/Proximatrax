import { notFound, redirect } from "next/navigation";
import { ProjectTimelineView } from "@/components/dashboard/project-timeline-view";
import { MilestoneEditor } from "../_overview/milestone-editor";
import { ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
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
    const project = await getProjectById(id, supabase, { withMilestones: true });
    if (!project)
        notFound();
    const milestones = project.milestones ?? [];
    if (role === "project_manager") {
        const { data: taskRows } = await supabase.from("tasks").select("milestone_id, stage").eq("project_id", id);
        const taskProgressByMilestone: Record<string, { total: number; done: number }> = {};
        for (const t of taskRows ?? []) {
            if (!t.milestone_id)
                continue;
            const bucket = (taskProgressByMilestone[t.milestone_id] ??= { total: 0, done: 0 });
            bucket.total += 1;
            if (t.stage === "done")
                bucket.done += 1;
        }
        const archived = project.status === "completed";
        return (<div className="space-y-6 pt-2">
        <MilestoneEditor projectId={id} initialMilestones={milestones} canEdit={!archived} viewerRole={role} projectStart={project.start_date} projectEnd={project.end_date} taskProgressByMilestone={taskProgressByMilestone} isArchived={archived}/>
        <ProjectTimelineView projectId={id} projectStart={project.start_date} projectEnd={project.end_date} milestones={milestones} viewerRole={role}/>
      </div>);
    }
    return (<ProjectTimelineView projectId={id} projectStart={project.start_date} projectEnd={project.end_date} milestones={milestones} viewerRole={role}/>);
}
