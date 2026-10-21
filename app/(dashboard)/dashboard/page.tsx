import { redirect } from "next/navigation";
import { ClientPortalHome } from "@/components/client-portal/client-portal-home";
import { PmDashboard } from "@/components/dashboard/pm-dashboard";
import { ProjectInvitationsInbox } from "@/components/projects/project-invitations-inbox";
import { OwnerOverview } from "@/components/analytics/owner-overview";
import { inquiryYear } from "@/lib/analytics";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { greeting, isoDateIn, type DashboardMilestone, type DashboardTask } from "@/lib/dashboard";
import { getViewer } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/services/project-invitation-service";
import { listProjects } from "@/services/project-service";
import { loadOwnerAnalytics } from "@/services/analytics-service";
import { getSuperAdminInquirySummaries, getSuperAdminViewedInquiryIds } from "@/lib/data/inquiry-shell";
import { triageCounts } from "@/lib/inquiry-triage";
import { loadProjectContext, projectContext } from "@/lib/data/project-context";
import { loadClientProject } from "@/lib/data/client-project";
import type { Profile } from "@/types/database";
export default async function DashboardPage() {
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const resolvedProfile = profile as Profile | null;
    const role = resolvedProfile?.role ?? "client";
    const now = new Date();
    const today = isoDateIn(now);
    const firstName = resolvedProfile?.full_name?.split(" ")[0];
    if (role === "super_admin") {
        const [analytics, inquiries, viewed] = await Promise.all([
            loadOwnerAnalytics(supabase, today),
            getSuperAdminInquirySummaries().catch(() => []),
            getSuperAdminViewedInquiryIds(user.id).catch(() => []),
        ]);
        return (<OwnerOverview greeting={`${greeting(now)}, ${firstName ?? "there"}`} today={today} analytics={analytics} inquiries={inquiryYear(inquiries, viewed, today.slice(0, 4))} unopenedInquiries={triageCounts(inquiries, viewed).totalUnopened}/>);
    }
    if (role === "project_manager") {
        // One round trip: tasks and milestones filter on their project's status instead of waiting for the project list.
        const [projects, taskResult, milestoneResult, rows] = await Promise.all([
            listProjects(supabase, { lifecycle: "active" }),
            supabase.from("tasks")
                .select("id, title, project_id, stage, due_date, client_visible_at, updated_at, assigned_to, project:projects!inner(status)")
                .neq("project.status", "completed"),
            supabase.from("milestones")
                .select("id, title, project_id, due_date, completed, project:projects!inner(status)")
                .neq("project.status", "completed"),
            loadProjectContext(supabase),
        ]);
        // RLS can show a task outside the PM's projects (one assigned to them); keep the Overview to its projects.
        const ids = new Set(projects.map((p) => p.id));
        const own = <T extends { project_id: string }>(list: T[] | null) => (list ?? []).filter((r) => ids.has(r.project_id));
        // Only the welcome screen needs this: "all closed" or "first project".
        const closedCount = projects.length > 0 ? 0 : (await supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "completed")).count ?? 0;
        return (<PmDashboard greeting={`${greeting(now)}, ${firstName ?? "there"}`} context={projectContext(projects, rows)} projects={projects} closedCount={closedCount} tasks={own(taskResult.data) as DashboardTask[]} milestones={own(milestoneResult.data) as DashboardMilestone[]} loadFailed={!!(taskResult.error || milestoneResult.error)} today={today} viewerId={user.id}/>);
    }
    if (role !== "client")
        redirect(getRoleHomePath(role));
    const projects = await listProjects(supabase, { lifecycle: "active" });
    const projectIds = projects.map((p) => p.id);
    // The lead project is read the way its own pages read it: approved photos, accepted work, the PM's latest word.
    const [milestoneResult, pendingInvitations, lead] = await Promise.all([
        projectIds.length > 0
            ? supabase.from("milestones").select("id, title, project_id, due_date, completed").in("project_id", projectIds)
            : { data: [] },
        listPendingInvitationsForUser(user.id, supabase),
        projects[0] ? loadClientProject(supabase, projects[0].id) : null,
    ]);
    return (<ClientPortalHome firstName={firstName ?? "there"} greeting={greeting(now)} today={today} projects={projects} milestones={(milestoneResult.data ?? []) as DashboardMilestone[]} lead={lead} notice={pendingInvitations.length > 0 ? <ProjectInvitationsInbox invitations={pendingInvitations}/> : null}/>);
}
