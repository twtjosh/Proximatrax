import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedMilestone } from "@/lib/auto-plan";
import type { Intake } from "@/lib/project-intake";
import { throwIfSupabaseError } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { createProjectInvitations } from "@/services/project-invitation-service";
import { createProject, deleteProject } from "@/services/project-service";

/**
 * Creates a project from a confirmed report and plan, as the PM, then locks
 * the plan. Tasks wait unassigned with `planned_to` until each invited crew
 * member accepts (migration 0034 hands them over). Any failure removes the
 * half-made project.
 */
export async function createReportProject(intake: Intake, plan: PlannedMilestone[], pmId: string, sb: SupabaseClient): Promise<string> {
    const project = await createProject({
        title: intake.title,
        description: intake.notes || null,
        pm_id: pmId,
        client_id: intake.clientId,
        start_date: intake.startDate,
        end_date: intake.endDate,
        status: "pending_invites",
    }, sb);
    try {
        await createProjectInvitations([
            { project_id: project.id, invitee_id: intake.clientId, invitee_role: "client", invited_by: pmId, project_title: project.title },
            ...intake.team.map((id) => ({ project_id: project.id, invitee_id: id, invitee_role: "middleman" as const, invited_by: pmId, project_title: project.title })),
        ], sb);
        throwIfSupabaseError((await sb.from("project_reports").insert({ project_id: project.id, data: intake, created_by: pmId })).error);
        const milestones = plan.map((m) => ({ id: crypto.randomUUID(), project_id: project.id, title: m.title.trim(), due_date: m.due_date, completed: false }));
        throwIfSupabaseError((await sb.from("milestones").insert(milestones)).error);
        let position = 0;
        const tasks = plan.flatMap((m, mi) => m.tasks.map((t) => ({
            project_id: project.id,
            milestone_id: milestones[mi].id,
            title: t.title.trim(),
            description: t.description.trim() || null,
            stage: "to_do",
            start_date: t.start_date,
            due_date: t.due_date,
            planned_to: t.planned_to,
            position: position++,
        })));
        throwIfSupabaseError((await sb.from("tasks").insert(tasks)).error);
        throwIfSupabaseError((await sb.from("projects").update({
            plan_locked_at: new Date().toISOString(),
            ...(intake.site ? { site_latitude: intake.site.lat, site_longitude: intake.site.lng } : {}),
        }).eq("id", project.id)).error);
        await logActivity({ project_id: project.id, action_type: "project_created", details: { title: project.title, invitations: "pending", plan: "from project report" } }, sb).catch(() => { });
        return project.id;
    }
    catch (error) {
        await deleteProject(project.id, sb).catch(() => { });
        throw error;
    }
}
