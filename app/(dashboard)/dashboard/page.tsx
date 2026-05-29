import Link from "next/link";
import { redirect } from "next/navigation";
import { AlertTriangle, Building2, ClipboardCheck, FolderKanban, Plus, Target, } from "lucide-react";
import { ClientPortalHome } from "@/components/client-portal/client-portal-home";
import { ProjectManagerHome } from "@/components/dashboard/project-manager-home";
import { ProjectStatusCard } from "@/components/dashboard/project-status-card";
import { ProjectInvitationsInbox } from "@/components/projects/project-invitations-inbox";
import { SuperAdminAnalyticsDashboard } from "@/components/superadmin/super-admin-analytics-dashboard";
import { Button } from "@/components/ui/button";
import { projectBoardPath, projectMessagesPath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { listPendingInvitationsForUser } from "@/services/project-invitation-service";
import { listProjects } from "@/services/project-service";
import { fetchSuperAdminAnalytics } from "@/services/super-admin-analytics-service";
import type { Profile } from "@/types/database";
import type { TaskPriority, UserRole } from "@/types/enums";
const CREATOR_ROLES: UserRole[] = ["project_manager"];
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
    const canCreate = CREATOR_ROLES.includes(role);
    const isSuperAdmin = role === "super_admin";
    if (isSuperAdmin) {
        const analytics = await fetchSuperAdminAnalytics(supabase);
        return (<SuperAdminAnalyticsDashboard name={resolvedProfile?.full_name?.split(" ")[0] ?? "SuperAdmin"} analytics={analytics}/>);
    }
    const projects = await listProjects(supabase);
    const recentProjects = projects.slice(0, 6);
    const projectIds = projects.map((p) => p.id);
    const today = new Date().toISOString().slice(0, 10);
    let delayedTasks = 0;
    let pendingReviews = 0;
    const progressByProject: Record<string, {
        total: number;
        done: number;
    }> = {};
    type TaskRow = {
        id: string;
        title: string;
        project_id: string;
        stage: string;
        due_date: string | null;
        priority: TaskPriority;
    };
    let taskRows: TaskRow[] = [];
    if (projectIds.length > 0) {
        const { data: taskData } = await supabase
            .from("tasks")
            .select("id, title, project_id, stage, due_date, priority")
            .in("project_id", projectIds);
        taskRows = (taskData ?? []) as TaskRow[];
        for (const pid of projectIds) {
            progressByProject[pid] = { total: 0, done: 0 };
        }
        for (const t of taskRows) {
            const pid = t.project_id as string;
            if (!progressByProject[pid])
                progressByProject[pid] = { total: 0, done: 0 };
            progressByProject[pid].total += 1;
            if (t.stage === "done")
                progressByProject[pid].done += 1;
            if (t.stage === "review")
                pendingReviews += 1;
            if (t.stage !== "done" &&
                t.due_date &&
                typeof t.due_date === "string" &&
                t.due_date < today) {
                delayedTasks += 1;
            }
        }
    }
    let completedMilestones = 0;
    if (projectIds.length > 0) {
        const { data: mrows } = await supabase
            .from("milestones")
            .select("completed")
            .in("project_id", projectIds);
        completedMilestones = (mrows ?? []).filter((m) => m.completed).length;
    }
    let upcomingMilestones: Array<{
        id: string;
        project_id: string;
        title: string;
        due_date: string;
    }> = [];
    if (projectIds.length > 0) {
        const { data: um } = await supabase
            .from("milestones")
            .select("id, project_id, title, due_date")
            .in("project_id", projectIds)
            .eq("completed", false)
            .order("due_date", { ascending: true })
            .limit(8);
        upcomingMilestones = (um ?? []) as typeof upcomingMilestones;
    }
    type PMDeadline = {
        kind: "milestone";
        id: string;
        project_id: string;
        title: string;
        due_date: string;
    } | {
        kind: "task";
        id: string;
        project_id: string;
        title: string;
        due_date: string;
        priority: TaskPriority;
    };
    let upcomingDeadlines: PMDeadline[] = [];
    let overdueDeadlines: PMDeadline[] = [];
    if (role === "project_manager" && projectIds.length > 0) {
        const { data: openMs } = await supabase
            .from("milestones")
            .select("id, project_id, title, due_date")
            .in("project_id", projectIds)
            .eq("completed", false);
        const ms = (openMs ?? []) as Array<{
            id: string;
            project_id: string;
            title: string;
            due_date: string;
        }>;
        const mUp: PMDeadline[] = [];
        const mOver: PMDeadline[] = [];
        for (const m of ms) {
            if (!m.due_date)
                continue;
            const row: PMDeadline = { kind: "milestone", ...m };
            if (m.due_date >= today)
                mUp.push(row);
            else
                mOver.push(row);
        }
        const tUp: PMDeadline[] = [];
        const tOver: PMDeadline[] = [];
        for (const t of taskRows) {
            if (t.stage === "done" || !t.due_date)
                continue;
            const row: PMDeadline = {
                kind: "task",
                id: t.id,
                project_id: t.project_id,
                title: t.title,
                due_date: t.due_date,
                priority: (t.priority ?? "medium") as TaskPriority,
            };
            if (t.due_date >= today)
                tUp.push(row);
            else
                tOver.push(row);
        }
        const byDueAsc = (a: PMDeadline, b: PMDeadline) => a.due_date.localeCompare(b.due_date);
        const byDueDesc = (a: PMDeadline, b: PMDeadline) => b.due_date.localeCompare(a.due_date);
        upcomingDeadlines = [...mUp, ...tUp].sort(byDueAsc).slice(0, 24);
        overdueDeadlines = [...mOver, ...tOver].sort(byDueDesc).slice(0, 12);
    }
    if (role === "project_manager") {
        return (<ProjectManagerHome firstName={resolvedProfile?.full_name?.split(" ")[0] ?? "PM"} projects={projects} progressByProject={progressByProject} upcomingDeadlines={upcomingDeadlines} overdueDeadlines={overdueDeadlines}/>);
    }
    if (role === "client") {
        const pendingInvitations = await listPendingInvitationsForUser(user.id, supabase);
        return (<div className="space-y-8">
        <ProjectInvitationsInbox invitations={pendingInvitations}/>
        <ClientPortalHome firstName={resolvedProfile?.full_name?.split(" ")[0] ?? "there"} projects={projects} progressByProject={progressByProject} upcomingMilestones={upcomingMilestones}/>
      </div>);
    }
    return (<div className="space-y-8">
      <header className="relative overflow-hidden border border-[#d97706]/20 bg-[#101826] p-7 text-white shadow-[0_24px_70px_rgba(15,23,42,0.14)]">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_top_right,rgba(217,119,6,0.22),transparent_34%),linear-gradient(135deg,rgba(255,255,255,0.08),transparent_42%)]"/>
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="space-y-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.24em] text-[#f3b35d]">
              Workspace Dashboard
            </p>
            <h1 className="max-w-3xl font-heading text-4xl tracking-tight">
              Welcome back, {resolvedProfile?.full_name?.split(" ")[0] ?? "User"}
            </h1>
            <p className="max-w-2xl text-sm leading-6 text-slate-300">
              See your assigned work and team communication in one place.
            </p>
          </div>

          {canCreate ? (<Button render={<Link href={`${ROUTES.PROJECTS}/new`}/>} className="h-11 rounded-none border border-[#f3b35d]/40 bg-[#d97706] px-5 font-mono text-xs uppercase tracking-[0.2em] text-slate-950 hover:bg-[#ef9b27]">
              <Plus className="h-4 w-4"/>
              New Project
            </Button>) : null}
        </div>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <StatCard label="Projects" value={projects.length} icon={FolderKanban} href={ROUTES.PROJECTS} accent/>
        <StatCard label="Delayed Tasks" value={delayedTasks} icon={AlertTriangle} href={ROUTES.PROJECTS}/>
        <StatCard label="Completed Milestones" value={completedMilestones} icon={Target} href={ROUTES.PROJECTS}/>
        <StatCard label="Pending Review" value={pendingReviews} icon={ClipboardCheck} href={ROUTES.PROJECTS}/>
      </div>

      <section className="grid gap-4 border border-slate-200 bg-white p-5 lg:grid-cols-[1fr_auto]">
        <div>
          <h2 className="font-heading text-sm tracking-tight text-slate-950">Quick actions</h2>
          <p className="mt-1 text-xs text-slate-500">
            Shortcuts into the operational tools you use most.
          </p>
        </div>
        <div className="flex flex-wrap gap-2 lg:justify-end">
          {canCreate ? (<Button render={<Link href={`${ROUTES.PROJECTS}/new`}/>} variant="outline" className="h-9 rounded-none border-slate-200 font-mono text-[10px] uppercase tracking-[0.14em]">
              <Plus className="h-3.5 w-3.5"/>
              Create project
            </Button>) : null}
          <Button render={<Link href={recentProjects[0]
                ? projectBoardPath(recentProjects[0].id)
                : ROUTES.PROJECTS}/>} variant="outline" className="h-9 rounded-none border-slate-200 font-mono text-[10px] uppercase tracking-[0.14em]">
            Open board
          </Button>
          <Button render={<Link href={recentProjects[0]
                ? projectMessagesPath(recentProjects[0].id)
                : ROUTES.PROJECTS}/>} variant="outline" className="h-9 rounded-none border-slate-200 font-mono text-[10px] uppercase tracking-[0.14em]">
            Messages
          </Button>
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="font-heading text-lg tracking-tight text-slate-950">Upcoming deadlines</h2>
        <ul className="border border-slate-200 bg-white">
          {upcomingMilestones.length === 0 ? (<li className="p-4 text-sm text-slate-500">No open milestones with dates.</li>) : (upcomingMilestones.map((m) => {
            const title = projects.find((p) => p.id === m.project_id)?.title ?? "Project";
            return (<li key={m.id} className="border-b border-slate-100 px-4 py-3 last:border-b-0">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {title}
                  </p>
                  <p className="mt-1 text-sm font-medium text-slate-900">{m.title}</p>
                  <p className="mt-1 text-xs text-[#9a4f02]">{m.due_date}</p>
                </li>);
        }))}
        </ul>
      </section>

      <section className="space-y-5">
        <div className="flex items-center justify-between">
          <h2 className="font-heading text-xl tracking-tight text-slate-950">
            Recent Projects
          </h2>
          <Link href={ROUTES.PROJECTS} className="font-mono text-[11px] uppercase tracking-[0.18em] text-[#d97706] hover:text-[#ef9b27]">
            View all
          </Link>
        </div>

        {recentProjects.length === 0 ? (<div className="flex flex-col items-center justify-center gap-4 border border-dashed border-slate-300 bg-white p-12 text-center">
            <div className="flex h-12 w-12 items-center justify-center border border-[#d97706]/30 bg-[#d97706]/10 text-[#9a4f02]">
              <Building2 className="h-5 w-5"/>
            </div>
            <div className="space-y-1">
              <h3 className="font-heading text-lg tracking-tight text-slate-950">
                No projects yet
              </h3>
              <p className="text-sm text-slate-500">
                {canCreate
                ? "Create your first project to get started."
                : "Projects assigned to you will appear here."}
              </p>
            </div>
          </div>) : (<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {recentProjects.map((project) => {
                const pr = progressByProject[project.id];
                const progressPct = pr && pr.total > 0 ? Math.round((pr.done / pr.total) * 100) : 0;
                return (<ProjectStatusCard key={project.id} project={project} progressPct={progressPct}/>);
            })}
          </div>)}
      </section>
    </div>);
}
function StatCard({ label, value, icon: Icon, href, accent, }: {
    label: string;
    value: number;
    icon: typeof Building2;
    href: string;
    accent?: boolean;
}) {
    return (<Link href={href} className="group relative overflow-hidden border border-slate-200 bg-white p-5 transition-all hover:-translate-y-0.5 hover:border-[#d97706]/40 hover:shadow-[0_18px_40px_rgba(217,119,6,0.10)]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-1 bg-linear-to-r from-[#d97706] via-[#f3b35d] to-transparent opacity-70"/>
      <div className="flex items-start justify-between">
        <div className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          {label}
        </div>
        <Icon className="h-4 w-4 text-slate-400 transition-colors group-hover:text-[#d97706]"/>
      </div>
      <div className={`mt-4 font-heading text-3xl tracking-tight ${accent ? "text-[#d97706]" : "text-slate-950"}`}>
        {value}
      </div>
    </Link>);
}
