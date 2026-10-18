import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDateIn, type DashboardMilestone } from "@/lib/dashboard";
import { loadProjectContext, projectContext, type TeamMember } from "@/lib/data/project-context";
import { loadSentBack } from "@/lib/data/sent-back";
import { getProjectById, type ProjectWithRelations } from "@/services/project-service";
import { listTasksForProject, type TaskWithRelations } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";

export type CrewProjectData = {
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    /** Every task on the project: the viewer's, and open work anyone may take. */
    tasks: TaskWithRelations[];
    /** Files the viewer uploaded on this project, newest first. */
    attachments: TaskAttachment[];
    /** The viewer's tasks the PM sent back, with when. */
    sentBack: Record<string, string>;
    /** PM, client, then members, as on the Overview tiles. */
    team: TeamMember[];
    unread: number;
    /** Manila calendar date; lateness is measured against it. */
    today: string;
    loadFailed: boolean;
};

/**
 * Everything a middleman's project shell and pages read, once per request:
 * the layout and the page both call this and share the result.
 */
export const loadCrewProject = cache(async (supabase: SupabaseClient, projectId: string, viewerId: string): Promise<CrewProjectData | null> => {
    // One round trip: nothing here waits on the project row, so it all leaves together.
    const [project, taskResult, attachmentResult, rows] = await Promise.all([
        getProjectById(projectId, supabase, { withMilestones: true }),
        listTasksForProject(projectId, supabase).then((list) => ({ list, failed: false }), () => ({ list: [] as TaskWithRelations[], failed: true })),
        supabase.from("task_attachments").select("*")
            .eq("project_id", projectId).eq("uploaded_by", viewerId)
            .order("created_at", { ascending: false }),
        loadProjectContext(supabase, [projectId]),
    ]);
    if (!project)
        return null;
    const context = projectContext([project], rows);
    const sentBack = await loadSentBack(supabase, taskResult.list.filter((t) => t.assigned_to === viewerId));
    return {
        project,
        milestones: (project.milestones ?? []).map((m) => ({ id: m.id, title: m.title, project_id: m.project_id, due_date: m.due_date, completed: m.completed })),
        tasks: taskResult.list,
        attachments: (attachmentResult.data ?? []) as TaskAttachment[],
        sentBack,
        team: context.teams[projectId] ?? [],
        unread: context.unread[projectId] ?? 0,
        today: isoDateIn(new Date()),
        loadFailed: taskResult.failed,
    };
});
