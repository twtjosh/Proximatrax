import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDateIn, type DashboardMilestone } from "@/lib/dashboard";
import { loadProjectContext, type TeamMember } from "@/lib/data/project-context";
import type { PmTask } from "@/lib/pm-project";
import { latestUpdate, type StatusUpdate } from "@/lib/project-log";
import { listProjectActivityPage, type ActivityWithActor } from "@/services/activity-service";
import { listInvitationsForProject } from "@/services/project-invitation-service";
import { getProjectById, type ProjectWithRelations } from "@/services/project-service";
import type { ProjectInvitationWithInvitee } from "@/types/database";

export type PmProjectData = {
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    tasks: PmTask[];
    /** PM, client, then members, as on the Overview tiles. */
    team: TeamMember[];
    /** Chat messages from others the PM has not read. */
    unread: number;
    /** Only loaded while the project waits on invites. */
    invitations: ProjectInvitationWithInvitee[];
    /** The newest rows of the project log, newest first. */
    activity: ActivityWithActor[];
    /** The PM's latest status update, however old. */
    update: StatusUpdate | null;
    /** Manila calendar date; overdue is measured against it. */
    today: string;
    loadFailed: boolean;
};

const ACTIVITY_COUNT = 10;

/**
 * Everything the PM's project shell and Overview read, once per request:
 * the layout and the page both call this and share the result.
 */
export const loadPmProject = cache(async (supabase: SupabaseClient, projectId: string, viewerId: string): Promise<PmProjectData | null> => {
    const project = await getProjectById(projectId, supabase, { withMilestones: true });
    if (!project)
        return null;
    const [taskResult, context, invitations, activity, updateRows] = await Promise.all([
        supabase.from("tasks")
            .select("id, title, project_id, stage, due_date, client_visible_at, updated_at, assigned_to, milestone_id")
            .eq("project_id", projectId),
        loadProjectContext(supabase, [project], viewerId),
        project.status === "pending_invites" ? listInvitationsForProject(projectId, supabase).catch(() => []) : Promise.resolve([]),
        listProjectActivityPage(projectId, { limit: ACTIVITY_COUNT }, supabase).catch(() => []),
        supabase.from("activity_feed").select("action_type, details, created_at, user_id")
            .eq("project_id", projectId).eq("action_type", "project_update")
            .order("created_at", { ascending: false }).limit(1),
    ]);
    const tasks = (taskResult.data ?? []) as PmTask[];
    const team = context.teams[projectId] ?? [];
    return {
        project,
        milestones: (project.milestones ?? []).map((m) => ({ id: m.id, title: m.title, project_id: m.project_id, due_date: m.due_date, completed: m.completed })),
        tasks,
        team,
        unread: context.unread[projectId] ?? 0,
        invitations,
        activity,
        update: latestUpdate((updateRows.data ?? []) as Parameters<typeof latestUpdate>[0]),
        today: isoDateIn(new Date()),
        loadFailed: !!taskResult.error,
    };
});
