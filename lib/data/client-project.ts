import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toClientPhotos, type ApprovedRow, type ClientPhoto } from "@/lib/client-project";
import { isoDateIn, type DashboardMilestone } from "@/lib/dashboard";
import { loadProjectContext, type TeamMember } from "@/lib/data/project-context";
import { getProjectById, type ProjectWithRelations } from "@/services/project-service";
import { listApprovedAttachmentsForProject, publicTaskAttachmentUrl } from "@/services/task-attachment-service";

export type { ClientPhoto };
export type ClientUpdate = { id: string; title: string; milestone_id: string | null; at: string };

export type ClientProjectData = {
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    /** Work the PM accepted, newest first. */
    updates: ClientUpdate[];
    /** Photos the PM approved for the client, newest first. */
    photos: ClientPhoto[];
    team: TeamMember[];
    unread: number;
    /** Manila calendar date. */
    today: string;
    loadFailed: boolean;
};

/**
 * Everything a client's project shell and pages read, once per request.
 * Only accepted work and approved photos are read, so nothing unapproved
 * reaches the client's browser.
 */
export const loadClientProject = cache(async (supabase: SupabaseClient, projectId: string, viewerId: string): Promise<ClientProjectData | null> => {
    const project = await getProjectById(projectId, supabase, { withMilestones: true });
    if (!project)
        return null;
    const [updateResult, photoResult, context] = await Promise.all([
        supabase.from("tasks").select("id, title, milestone_id, client_visible_at")
            .eq("project_id", projectId).not("client_visible_at", "is", null)
            .order("client_visible_at", { ascending: false }),
        listApprovedAttachmentsForProject(projectId, supabase).then((rows) => ({ rows: rows as unknown as ApprovedRow[], failed: false }), () => ({ rows: [] as ApprovedRow[], failed: true })),
        loadProjectContext(supabase, [project], viewerId),
    ]);
    const rows = (updateResult.data ?? []) as { id: string; title: string; milestone_id: string | null; client_visible_at: string }[];
    return {
        project,
        milestones: (project.milestones ?? []).map((m) => ({ id: m.id, title: m.title, project_id: m.project_id, due_date: m.due_date, completed: m.completed })),
        updates: rows.map((t) => ({ id: t.id, title: t.title, milestone_id: t.milestone_id, at: t.client_visible_at })),
        photos: toClientPhotos(photoResult.rows, publicTaskAttachmentUrl),
        team: context.teams[projectId] ?? [],
        unread: context.unread[projectId] ?? 0,
        today: isoDateIn(new Date()),
        loadFailed: Boolean(updateResult.error) || photoResult.failed,
    };
});
