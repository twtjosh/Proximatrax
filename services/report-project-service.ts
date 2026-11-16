import type { SupabaseClient } from "@supabase/supabase-js";
import type { PlannedMilestone } from "@/lib/auto-plan";
import type { Intake } from "@/lib/project-intake";
import { throwIfSupabaseError } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { createProject, deleteProject } from "@/services/project-service";

/**
 * Creates a project from a confirmed report and plan, then locks the plan.
 * Nobody has to accept an invitation: the crew join at once and get their
 * tasks, and both invitations are recorded as already accepted (by the
 * service role, `admin`) so the client sees the project and the team page
 * has its record. Everything else is written as the PM, under RLS. Any
 * failure removes the half-made project.
 */
export async function createReportProject(intake: Intake, plan: PlannedMilestone[], pmId: string, sb: SupabaseClient, admin: SupabaseClient): Promise<string> {
    const project = await createProject({
        title: intake.title,
        description: intake.notes || null,
        pm_id: pmId,
        client_id: intake.clientId,
        start_date: intake.startDate,
        end_date: intake.endDate,
        status: "planning",
    }, sb);
    try {
        throwIfSupabaseError((await sb.from("project_reports").insert({ project_id: project.id, data: intake, created_by: pmId })).error);
        if (intake.team.length > 0)
            throwIfSupabaseError((await sb.from("project_members").insert(intake.team.map((id) => ({ project_id: project.id, user_id: id, role_in_project: "middleman" })))).error);
        const now = new Date().toISOString();
        throwIfSupabaseError((await admin.from("project_invitations").insert([
            { project_id: project.id, invitee_id: intake.clientId, invitee_role: "client", invited_by: pmId, project_title: project.title, status: "accepted", responded_at: now },
            ...intake.team.map((id) => ({ project_id: project.id, invitee_id: id, invitee_role: "middleman", invited_by: pmId, project_title: project.title, status: "accepted", responded_at: now })),
        ])).error);
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
            assigned_to: t.planned_to,
            planned_to: t.planned_to,
            position: position++,
        })));
        throwIfSupabaseError((await sb.from("tasks").insert(tasks)).error);
        throwIfSupabaseError((await sb.from("projects").update({
            plan_locked_at: new Date().toISOString(),
            ...(intake.site ? { site_latitude: intake.site.lat, site_longitude: intake.site.lng } : {}),
        }).eq("id", project.id)).error);
        await logActivity({ project_id: project.id, action_type: "project_created", details: { title: project.title, plan: "from project report", team: intake.team.length } }, sb).catch(() => { });
        return project.id;
    }
    catch (error) {
        await deleteProject(project.id, sb).catch(() => { });
        throw error;
    }
}
