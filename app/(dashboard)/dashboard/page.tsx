import { redirect } from "next/navigation";
import { ClientPortalHome } from "@/components/client-portal/client-portal-home";
import { PmDashboard } from "@/components/dashboard/pm-dashboard";
import { ProjectInvitationsInbox } from "@/components/projects/project-invitations-inbox";
import { SuperAdminAnalyticsDashboard } from "@/components/superadmin/super-admin-analytics-dashboard";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { greeting, isoDateIn, type DashboardMilestone, type DashboardTask } from "@/lib/dashboard";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/services/project-invitation-service";
import { listProjects } from "@/services/project-service";
import { fetchSuperAdminAnalytics } from "@/services/super-admin-analytics-service";
import { getSuperAdminInquirySummaries, getSuperAdminViewedInquiryIds } from "@/lib/data/inquiry-shell";
import { triageCounts } from "@/lib/inquiry-triage";
import { loadProjectContext } from "@/lib/data/project-context";
import { listApprovedAttachmentsForProject, publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import type { Profile } from "@/types/database";
export default async function DashboardPage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
    const resolvedProfile = profile as Profile | null;
    const role = resolvedProfile?.role ?? "client";
    const now = new Date();
    const today = isoDateIn(now);
    const firstName = resolvedProfile?.full_name?.split(" ")[0];
    if (role === "super_admin") {
        const [analytics, inquiries, viewed] = await Promise.all([
            fetchSuperAdminAnalytics(supabase),
            getSuperAdminInquirySummaries().catch(() => []),
            getSuperAdminViewedInquiryIds(user.id).catch(() => []),
        ]);
        return (<SuperAdminAnalyticsDashboard greeting={`${greeting(now)}, ${firstName ?? "there"}`} today={today} analytics={analytics} unopenedInquiries={triageCounts(inquiries, viewed).totalUnopened}/>);
    }
    if (role === "project_manager") {
        const projects = await listProjects(supabase, { lifecycle: "active" });
        const projectIds = projects.map((p) => p.id);
        // Only the welcome screen needs this: "all closed" or "first project".
        const closedCount = projects.length > 0 ? 0 : (await supabase.from("projects").select("id", { count: "exact", head: true }).eq("status", "completed")).count ?? 0;
        const [[taskResult, milestoneResult], context] = await Promise.all([projectIds.length > 0
            ? Promise.all([
                supabase
                    .from("tasks")
                    .select("id, title, project_id, stage, due_date, client_visible_at, updated_at, assigned_to")
                    .in("project_id", projectIds),
                supabase
                    .from("milestones")
                    .select("id, title, project_id, due_date, completed")
                    .in("project_id", projectIds),
            ])
            : Promise.resolve([{ data: [], error: null }, { data: [], error: null }] as const), loadProjectContext(supabase, projects, user.id)]);
        return (<PmDashboard greeting={`${greeting(now)}, ${firstName ?? "there"}`} context={context} projects={projects} closedCount={closedCount} tasks={(taskResult.data ?? []) as DashboardTask[]} milestones={(milestoneResult.data ?? []) as DashboardMilestone[]} loadFailed={!!(taskResult.error || milestoneResult.error)} today={today}/>);
    }
    if (role !== "client")
        redirect(getRoleHomePath(role));
    const projects = await listProjects(supabase, { lifecycle: "active" });
    const projectIds = projects.map((p) => p.id);
    const [milestoneResult, pendingInvitations] = await Promise.all([
        projectIds.length > 0
            ? supabase.from("milestones").select("id, title, project_id, due_date, completed").in("project_id", projectIds)
            : { data: [] },
        listPendingInvitationsForUser(user.id, supabase),
    ]);
    // The lead project's PM-approved site photos and the size of its site team; both optional.
    const featured = projects[0];
    const [approved, siteCount] = featured
        ? await Promise.all([
            listApprovedAttachmentsForProject(featured.id, supabase).catch(() => []),
            supabase.from("project_members").select("user_id", { count: "exact", head: true }).eq("project_id", featured.id).eq("role_in_project", "middleman")
                .then((r) => (r.error ? null : r.count ?? 0)),
        ])
        : [[], null];
    // Newest first; the first leads the page, the next few sit beside the progress.
    const photos = approved.filter((a) => a.media_kind === "photo").slice(0, 5).map((a) => ({ url: publicTaskAttachmentUrl(a.storage_path), caption: a.task?.title ?? null, at: a.approved_for_client_at ?? a.created_at }));
    return (<ClientPortalHome firstName={firstName ?? "there"} greeting={greeting(now)} today={today} projects={projects} milestones={(milestoneResult.data ?? []) as DashboardMilestone[]} photos={photos} siteCount={siteCount} notice={pendingInvitations.length > 0 ? <ProjectInvitationsInbox invitations={pendingInvitations}/> : null}/>);
}
