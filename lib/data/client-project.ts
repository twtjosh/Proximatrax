import { cache } from "react";
import type { SupabaseClient } from "@supabase/supabase-js";
import { toClientPhotos, type ApprovedRow, type ClientPhoto } from "@/lib/client-project";
import { isoDateIn, type DashboardMilestone } from "@/lib/dashboard";
import { loadProjectContext, type TeamMember } from "@/lib/data/project-context";
import { latestUpdate, type StatusUpdate } from "@/lib/project-log";
import { getProjectById, type ProjectWithRelations } from "@/services/project-service";
import type { ProjectFile } from "@/types/database";
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
    /** The PM's latest status update. */
    update: StatusUpdate | null;
    /** Documents the PM shared, newest first. */
    documents: ProjectFile[];
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
    const [updateResult, photoResult, context, statusRows, documents] = await Promise.all([
        supabase.from("tasks").select("id, title, milestone_id, client_visible_at")
            .eq("project_id", projectId).not("client_visible_at", "is", null)
            .order("client_visible_at", { ascending: false }),
        listApprovedAttachmentsForProject(projectId, supabase).then((rows) => ({ rows: rows as unknown as ApprovedRow[], failed: false }), () => ({ rows: [] as ApprovedRow[], failed: true })),
        loadProjectContext(supabase, [project], viewerId),
        supabase.from("activity_feed").select("action_type, details, created_at, user_id")
            .eq("project_id", projectId).eq("action_type", "project_update")
            .order("created_at", { ascending: false }).limit(1),
        // RLS returns only shared files to a client; before migration 0024 the table is missing and this is empty.
        supabase.from("project_files").select("*").eq("project_id", projectId).not("shared_with_client_at", "is", null)
            .order("shared_with_client_at", { ascending: false }),
    ]);
    const rows = (updateResult.data ?? []) as { id: string; title: string; milestone_id: string | null; client_visible_at: string }[];
    return {
        project,
        milestones: (project.milestones ?? []).map((m) => ({ id: m.id, title: m.title, project_id: m.project_id, due_date: m.due_date, completed: m.completed })),
        updates: rows.map((t) => ({ id: t.id, title: t.title, milestone_id: t.milestone_id, at: t.client_visible_at })),
        photos: toClientPhotos(photoResult.rows, publicTaskAttachmentUrl),
        team: context.teams[projectId] ?? [],
        update: latestUpdate((statusRows.data ?? []) as Parameters<typeof latestUpdate>[0]),
        documents: (documents.data ?? []) as ProjectFile[],
        unread: context.unread[projectId] ?? 0,
        today: isoDateIn(new Date()),
        loadFailed: Boolean(updateResult.error) || photoResult.failed,
    };
});
