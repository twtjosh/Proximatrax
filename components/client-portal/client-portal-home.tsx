import Link from "next/link";
import { ArrowRight, CalendarDays, MessageSquare, LayoutGrid, Timer, Paperclip, } from "lucide-react";
import { ProjectStatusCard } from "@/components/dashboard/project-status-card";
import { Button } from "@/components/ui/button";
import { projectBoardPath, projectMessagesPath, projectPath, projectTimelinePath, ROUTES, } from "@/lib/constants";
import { splitProjectsByLifecycle } from "@/lib/project-lifecycle";
import type { ProjectWithRelations } from "@/services/project-service";
type ClientPortalHomeProps = {
    firstName: string;
    projects: ProjectWithRelations[];
    progressByProject: Record<string, {
        total: number;
        done: number;
    }>;
    upcomingMilestones: Array<{
        id: string;
        project_id: string;
        title: string;
        due_date: string;
    }>;
};
export function ClientPortalHome({ firstName, projects, progressByProject, upcomingMilestones, }: ClientPortalHomeProps) {
    const projectTitleMap: Record<string, string> = {};
    for (const p of projects) {
        projectTitleMap[p.id] = p.title;
    }
    const { active } = splitProjectsByLifecycle(projects);
    const featured = active[0];
    const recentProjects = active.slice(0, 5);
    const visibleMilestoneRows = 3;
    return (<div className="space-y-10 pb-8">
      <section className="relative overflow-hidden rounded-2xl border border-stone-200/90 bg-linear-to-br from-stone-900 via-stone-900 to-stone-800 px-6 py-10 text-white shadow-[0_24px_60px_-12px_rgba(28,25,23,0.35)] sm:px-10 sm:py-12">
        <div className="pointer-events-none absolute -right-24 -top-24 h-64 w-64 rounded-full bg-amber-500/15 blur-3xl" aria-hidden/>
        <div className="pointer-events-none absolute bottom-0 left-1/3 h-40 w-96 translate-y-1/2 rounded-full bg-white/4 blur-2xl" aria-hidden/>
        <div className="relative grid gap-10 lg:grid-cols-[minmax(0,1fr)_280px] lg:items-end">
          <div className="space-y-5">
            <p className="text-[11px] font-medium uppercase tracking-[0.2em] text-amber-200/90">
              AEG Fashion · Client access
            </p>
            <h1 className="max-w-xl font-heading text-3xl font-semibold tracking-tight sm:text-4xl">
              Hello, {firstName}
            </h1>
            <p className="max-w-lg text-[15px] leading-relaxed text-stone-300">
              Follow milestone progress, review deliverables, and stay in sync with your project
              manager — without operational noise.
            </p>
            <div className="flex flex-wrap gap-3 pt-2">
              {featured ? (<Button render={<Link href={projectPath(featured.id)}/>} className="h-11 rounded-xl bg-white px-5 text-sm font-medium text-stone-900 shadow-sm hover:bg-stone-100">
                  Open primary project
                  <ArrowRight className="ml-1 h-4 w-4"/>
                </Button>) : null}
              <Button render={<Link href={ROUTES.PROJECTS}/>} variant="outline" className="h-11 rounded-xl border-white/25 bg-white/5 px-5 text-sm font-medium text-white backdrop-blur-sm hover:bg-white/10">
                All projects
              </Button>
            </div>
          </div>
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-2 lg:grid-cols-1">
            <div className="rounded-xl border border-white/10 bg-white/6 p-4 backdrop-blur-sm">
              <dt className="text-[11px] font-medium uppercase tracking-wide text-stone-400">
                Active projects
              </dt>
              <dd className="mt-1 font-heading text-3xl font-semibold tabular-nums">
                {active.length}
              </dd>
            </div>
          </dl>
        </div>
      </section>

      {featured ? (<section className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-4">
              <div>
                <h2 className="font-heading text-lg font-semibold tracking-tight text-stone-900">
                  Continue where you left off
                </h2>
                <p className="mt-1 text-sm text-stone-600">
                  Quick links into the areas clients use most on this engagement.
                </p>
              </div>
              <Link href={projectPath(featured.id)} className="hidden shrink-0 text-sm font-medium text-amber-800 hover:text-amber-900 sm:inline-flex sm:items-center sm:gap-1">
                Full overview
                <ArrowRight className="h-4 w-4"/>
              </Link>
            </div>
            <div className="rounded-2xl border border-stone-200/90 bg-white p-6 shadow-sm">
              <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-2">
                  <h3 className="font-heading text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
                    {featured.title}
                  </h3>
                  {featured.description ? (<p className="max-w-2xl text-sm leading-relaxed text-stone-600 line-clamp-2">
                      {featured.description}
                    </p>) : null}
                  <p className="text-sm text-stone-600">
                    <span className="text-stone-500">Project manager · </span>
                    <span className="font-medium text-stone-800">
                      {featured.pm?.full_name ?? "Assigned soon"}
                    </span>
                  </p>
                </div>
                <div className="shrink-0 text-right sm:pt-1">
                  <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                    Overall progress
                  </p>
                  <p className="mt-1 font-heading text-3xl font-semibold tabular-nums text-stone-900">
                    {progressPct(progressByProject, featured.id)}%
                  </p>
                </div>
              </div>
              <div className="mt-5 h-2 overflow-hidden rounded-full bg-stone-100">
                <div className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-500 transition-all" style={{ width: `${progressPct(progressByProject, featured.id)}%` }}/>
              </div>
              <div className="mt-6 flex flex-wrap gap-2">
                <Button render={<Link href={projectPath(featured.id)}/>} variant="outline" size="sm" className="rounded-lg border-stone-200">
                  Overview
                </Button>
                <Button render={<Link href={projectTimelinePath(featured.id)}/>} variant="outline" size="sm" className="rounded-lg border-stone-200">
                  <Timer className="mr-1.5 h-3.5 w-3.5"/>
                  Timeline
                </Button>
                <Button render={<Link href={projectBoardPath(featured.id)}/>} variant="outline" size="sm" className="rounded-lg border-stone-200">
                  <LayoutGrid className="mr-1.5 h-3.5 w-3.5"/>
                  Board
                </Button>
                <Button render={<Link href={projectMessagesPath(featured.id)}/>} variant="outline" size="sm" className="rounded-lg border-stone-200">
                  <MessageSquare className="mr-1.5 h-3.5 w-3.5"/>
                  Messages
                </Button>
                <Button render={<Link href={`${projectMessagesPath(featured.id)}?media=1`}/>} variant="outline" size="sm" className="rounded-lg border-stone-200">
                  <Paperclip className="mr-1.5 h-3.5 w-3.5"/>
                  Shared media
                </Button>
              </div>
            </div>
          </div>

          <aside className="space-y-3">
            <h2 className="font-heading text-lg font-semibold tracking-tight text-stone-900">
              Upcoming milestones
            </h2>
            <ul className="overflow-y-auto rounded-2xl border border-stone-200/90 bg-white shadow-sm" style={{ maxHeight: `calc(${visibleMilestoneRows} * 5.25rem)` }}>
              {upcomingMilestones.length === 0 ? (<li className="px-4 py-8 text-center text-sm text-stone-500">
                  No dated milestones yet. Your PM will publish dates as the plan firms up.
                </li>) : (upcomingMilestones.map((m) => {
                const projectTitle = projectTitleMap[m.project_id] ?? "Project";
                return (<li key={m.id} className="border-b border-stone-100 px-4 py-3.5 last:border-b-0">
                      <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
                        {projectTitle}
                      </p>
                      <p className="mt-1 text-sm font-medium text-stone-900">{m.title}</p>
                      <p className="mt-1.5 flex items-center gap-1.5 text-xs text-stone-600">
                        <CalendarDays className="h-3.5 w-3.5 text-stone-400"/>
                        {m.due_date}
                      </p>
                    </li>);
            }))}
            </ul>
          </aside>
        </section>) : null}

      <section className="space-y-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-heading text-lg font-semibold tracking-tight text-stone-900">
            Active engagements
          </h2>
          <Link href={ROUTES.PROJECTS} className="text-sm font-medium text-amber-800 hover:text-amber-900">
            View all
          </Link>
        </div>
        {recentProjects.length === 0 ? (<div className="rounded-2xl border border-dashed border-stone-300 bg-stone-50/80 px-6 py-14 text-center">
            <p className="text-sm text-stone-600">
              When your project manager assigns you to an engagement, it will appear here with
              milestones, files, and messaging.
            </p>
          </div>) : (<div className="grid gap-4 sm:grid-cols-2">
            {recentProjects.map((project) => {
                const pr = progressByProject[project.id];
                const pct = pr && pr.total > 0 ? Math.round((pr.done / pr.total) * 100) : 0;
                return (<ProjectStatusCard key={project.id} project={project} progressPct={pct} variant="client"/>);
            })}
          </div>)}
      </section>
    </div>);
}
function progressPct(map: Record<string, {
    total: number;
    done: number;
}>, projectId: string) {
    const pr = map[projectId];
    if (!pr || pr.total <= 0)
        return 0;
    return Math.round((pr.done / pr.total) * 100);
}
