import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { isoDateIn, type DashboardMilestone } from "@/lib/dashboard";
import { loadProjectContext, type TeamMember } from "@/lib/data/project-context";
import type { PmTask } from "@/lib/pm-project";
import { listInvitationsForProject } from "@/services/project-invitation-service";
import { getProjectById, type ProjectWithRelations } from "@/services/project-service";
import { publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import type { ProjectInvitationWithInvitee } from "@/types/database";

export type SitePhoto = { id: string; url: string; taskTitle: string; by: string; at: string };

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
    /** The newest site photos, newest first. */
    photos: SitePhoto[];
    /** Manila calendar date; overdue is measured against it. */
    today: string;
    loadFailed: boolean;
};

const PHOTO_COUNT = 3;

/**
 * Everything the PM's project shell and Overview read, once per request:
 * the layout and the page both call this and share the result.
 */
export const loadPmProject = cache(async (supabase: SupabaseClient, projectId: string, viewerId: string): Promise<PmProjectData | null> => {
    const project = await getProjectById(projectId, supabase, { withMilestones: true });
    if (!project)
        return null;
    const [taskResult, photoResult, context, invitations] = await Promise.all([
        supabase.from("tasks")
            .select("id, title, project_id, stage, due_date, client_visible_at, updated_at, assigned_to, milestone_id")
            .eq("project_id", projectId),
        supabase.from("task_attachments")
            .select("id, task_id, storage_path, uploaded_by, created_at")
            .eq("project_id", projectId).eq("media_kind", "photo")
            .order("created_at", { ascending: false }).limit(PHOTO_COUNT),
        loadProjectContext(supabase, [project], viewerId),
        project.status === "pending_invites" ? listInvitationsForProject(projectId, supabase).catch(() => []) : Promise.resolve([]),
    ]);
    const tasks = (taskResult.data ?? []) as PmTask[];
    const team = context.teams[projectId] ?? [];
    const photoRows = (photoResult.data ?? []) as { id: string; task_id: string; storage_path: string; uploaded_by: string; created_at: string }[];
    return {
        project,
        milestones: (project.milestones ?? []).map((m) => ({ id: m.id, title: m.title, project_id: m.project_id, due_date: m.due_date, completed: m.completed })),
        tasks,
        team,
        unread: context.unread[projectId] ?? 0,
        invitations,
        photos: photoRows.map((p) => ({
            id: p.id,
            url: publicTaskAttachmentUrl(p.storage_path),
            taskTitle: tasks.find((t) => t.id === p.task_id)?.title ?? "Site photo",
            by: team.find((m) => m.id === p.uploaded_by)?.name ?? "Someone",
            at: p.created_at,
        })),
        today: isoDateIn(new Date()),
        loadFailed: !!taskResult.error,
    };
});
