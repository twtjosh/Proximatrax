import Link from "next/link";
import { redirect } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ProjectStatusCard } from "@/components/dashboard/project-status-card";
import { ProjectsLifecycleTabs } from "@/components/projects/projects-lifecycle-tabs";
import { ROUTES, type ProjectsListView } from "@/lib/constants";
import { splitProjectsByLifecycle } from "@/lib/project-lifecycle";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/server";
import { listProjects } from "@/services/project-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
const CREATOR_ROLES: UserRole[] = ["project_manager"];
type SearchParams = Promise<{
    q?: string;
    view?: string;
}>;
export default async function ProjectsPage(props: {
    searchParams?: SearchParams;
}) {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
    const resolvedProfile = (profile as Profile | null) ?? null;
    if (resolvedProfile?.role === "super_admin") {
        return <MaintenanceOnlyNotice />;
    }
    const canCreate = resolvedProfile
        ? CREATOR_ROLES.includes(resolvedProfile.role)
        : false;
    const params = (await props.searchParams) ?? {};
    const search = params.q;
    const view: ProjectsListView = params.view === "completed" ? "completed" : "active";
    const allProjects = await listProjects(supabase, { search });
    const { active, completed } = splitProjectsByLifecycle(allProjects);
    const projects = view === "completed" ? completed : active;
    const projectIds = projects.map((p) => p.id);
    const progressByProject: Record<string, {
        total: number;
        done: number;
    }> = {};
    if (projectIds.length > 0) {
        const { data: taskData } = await supabase
            .from("tasks")
            .select("project_id, stage")
            .in("project_id", projectIds);
        for (const pid of projectIds) {
            progressByProject[pid] = { total: 0, done: 0 };
        }
        for (const t of taskData ?? []) {
            const pid = t.project_id as string;
            if (!progressByProject[pid])
                progressByProject[pid] = { total: 0, done: 0 };
            progressByProject[pid].total += 1;
            if (t.stage === "done")
                progressByProject[pid].done += 1;
        }
    }
    const isMiddleman = resolvedProfile?.role === "middleman";
    const isClient = resolvedProfile?.role === "client";
    const isPm = resolvedProfile?.role === "project_manager";
    const isArchiveView = view === "completed";
    return (<div className={cn("space-y-6", isPm && "mx-auto max-w-[1200px] pb-2")}>
      <header className={isClient
            ? "flex flex-col gap-5 border-b border-stone-200/90 pb-8 md:flex-row md:items-end md:justify-between"
            : isPm
                ? "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between"
                : "flex flex-col gap-5 border-b border-slate-200 pb-6 md:flex-row md:items-end md:justify-between"}>
        <div className={cn("space-y-2", isPm && "space-y-1.5")}>
          {!isPm ? (<p className={isClient
                ? "text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500"
                : "font-mono text-[10px] uppercase tracking-[0.24em] text-[#d97706]"}>
              {isMiddleman ? "Field workspace · My projects" : isClient ? "Portfolio" : "Workspace · Projects"}
            </p>) : null}
          {!isPm ? (<h1 className={isClient
                ? "font-heading text-3xl font-semibold tracking-tight text-stone-900 sm:text-[2rem]"
                : "font-heading text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl"}>
            {isMiddleman
                ? isArchiveView
                    ? "Completed archive"
                    : "Sites you are assigned to"
                : isClient
                    ? isArchiveView
                        ? "Completed archive"
                        : "Your projects"
                    : isArchiveView
                        ? "Completed archive"
                        : "All engagements"}
          </h1>) : null}
          <p className={cn(isClient ? "max-w-2xl text-sm leading-relaxed text-stone-600" : "max-w-2xl text-sm leading-relaxed text-slate-500", isPm && "text-[13px] text-muted-ink")}>
            {isArchiveView ? (isClient ? (<>
                  Formally closed engagements with AEG Fashion — milestones,
                  deliverables, and messages remain available for reference.
                </>) : isMiddleman ? (<>
                  Read-only record of finished sites. Board and field updates are
                  locked unless the project manager reopens the engagement.
                </>) : (<>
                  Formally closed engagements — read-only for every role until
                  reopened from the project overview.
                </>)) : isMiddleman ? (<>
                Open a project to update your tasks on the board, upload progress photos in
                shared media in Messages — aligned with AEG field execution workflows.
              </>) : isClient ? (<>
                A clear view of every engagement you have with AEG — milestones, deliverables, and
                updates in one place. Open a project for timeline detail and messaging with your
                project manager.
              </>) : (<>
                All projects you have visibility into — filtered by your role permissions. Open a
                project to view milestones, tasks, and the team.
              </>)}
          </p>
        </div>

        {canCreate && !isPm ? (<Button render={<Link href={`${ROUTES.PROJECTS}/new`}/>} className="h-10 rounded-xl border border-[#d97706]/30 bg-[#d97706] px-4 text-sm font-medium text-slate-950 shadow-sm hover:bg-[#f59e0b]">
            <Plus className="h-4 w-4"/>
            New project
          </Button>) : null}
      </header>

      <ProjectsLifecycleTabs view={view} activeCount={active.length} completedCount={completed.length} variant={isClient ? "client" : isMiddleman ? "middleman" : "pm"}/>

      {projects.length === 0 ? (<EmptyState canCreate={canCreate} isPm={isPm} view={view}/>) : (<div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {projects.map((project) => {
                const pr = progressByProject?.[project.id];
                const progressPct = pr && pr.total > 0 ? Math.round((pr.done / pr.total) * 100) : 0;
                return (<ProjectStatusCard key={project.id} project={project} progressPct={progressPct} variant={isClient ? "client" : "default"}/>);
            })}
        </div>)}
    </div>);
}
function MaintenanceOnlyNotice() {
    return (<div className="flex flex-col items-center justify-center gap-4 border border-red-200 bg-white p-12 text-center">
      <Building2 className="h-8 w-8 text-red-400"/>
      <div>
        <h2 className="font-heading text-lg tracking-tight text-slate-950">
          Projects are outside SuperAdmin scope
        </h2>
        <p className="mt-2 max-w-md text-sm leading-6 text-slate-500">
          SuperAdmin access is reserved for maintenance and account
          provisioning. Use an Admin account to manage projects.
        </p>
      </div>
    </div>);
}
function EmptyState({ canCreate, isPm, view, }: {
    canCreate: boolean;
    isPm?: boolean;
    view: ProjectsListView;
}) {
    const isArchive = view === "completed";
    return (<div className={cn("flex flex-col items-center justify-center gap-4 border border-dashed bg-white p-12 text-center", isPm
            ? "rounded-2xl border-slate-200 shadow-sm"
            : "border-slate-300")}>
      <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-amber-50 text-[#d97706] ring-1 ring-amber-200/60">
        <Building2 className="h-5 w-5"/>
      </div>
      <div className="space-y-1">
        <h2 className="font-heading text-lg font-semibold tracking-tight text-slate-950">
          {isArchive ? "No completed projects" : "No active projects"}
        </h2>
        <p className="text-sm text-slate-500">
          {isArchive
            ? "Finished engagements appear here after your project manager formally closes them."
            : canCreate
                ? "Spin up your first engagement to start tracking milestones, tasks, and progress."
                : "You haven't been assigned to any active projects yet. Completed work lives in the archive tab."}
        </p>
      </div>
      {canCreate && !isArchive ? (<Button render={<Link href={`${ROUTES.PROJECTS}/new`}/>} className="h-10 rounded-xl border border-[#d97706]/30 bg-[#d97706] px-4 text-sm font-medium text-slate-950 shadow-sm hover:bg-[#f59e0b]">
          <Plus className="h-4 w-4"/>
          Create your first project
        </Button>) : null}
    </div>);
}
