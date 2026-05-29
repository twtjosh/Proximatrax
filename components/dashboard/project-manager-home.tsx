import Link from "next/link";
import type { ReactNode } from "react";
import { AlertCircle, ArrowRight, CalendarDays, CalendarClock, ChevronRight, ClipboardList, Flag, FolderKanban, LayoutGrid, Plus, Sparkles, Timer, UserRound, } from "lucide-react";
import { projectBoardPath, projectPath, ROUTES } from "@/lib/constants";
import { buildPmSchedule, priorityBadgeClass, TASK_PRIORITY_LABELS, type PMDeadlineRow, type PMScheduleItem, } from "@/lib/pm-deadline-utils";
import { PM_ACTION_ORB, PM_BTN_FILLED, PM_BTN_OUTLINE, PM_CARD_CLICKABLE, PM_LINK_ACTION, PM_OVERDUE_ICON, PM_OVERDUE_ROW, PM_OVERDUE_TEXT, PM_PROJECT_STATUS_CHIP, PM_PROJECT_STATUS_DOT, PM_PROJECT_STATUS_RAIL, PM_ROW_CLICKABLE, PM_MILESTONE_BADGE, PM_SURFACE_STATIC, } from "@/lib/pm-theme";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations } from "@/services/project-service";
import type { ProjectStatus } from "@/types/enums";
type DeadlineRow = PMDeadlineRow;
const SCHEDULE_VISIBLE = 5;
const PROJECT_STATUS_LABELS: Record<ProjectStatus, string> = {
    pending_invites: "Awaiting invites",
    planning: "Not started",
    in_progress: "In progress",
    on_hold: "On hold",
    completed: "Completed",
};
function formatShortDate(iso: string) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
    });
}
function formatWeekday(iso: string) {
    return new Date(`${iso}T12:00:00`).toLocaleDateString(undefined, {
        weekday: "short",
    });
}
function greetingFor(firstName: string) {
    const hour = new Date().getHours();
    if (hour < 12)
        return `Good morning, ${firstName}`;
    if (hour < 17)
        return `Good afternoon, ${firstName}`;
    return `Good evening, ${firstName}`;
}
function formatTodayLong() {
    return new Date().toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
    });
}
function isDueWithinDays(iso: string, days: number) {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const due = new Date(`${iso}T12:00:00`);
    const limit = new Date(today);
    limit.setDate(limit.getDate() + days);
    return due >= today && due <= limit;
}
export function ProjectManagerHome({ firstName, projects, progressByProject, upcomingDeadlines, overdueDeadlines, }: {
    firstName: string;
    projects: ProjectWithRelations[];
    progressByProject: Record<string, {
        total: number;
        done: number;
    }>;
    upcomingDeadlines: DeadlineRow[];
    overdueDeadlines: DeadlineRow[];
}) {
    const activeProjects = [...projects]
        .filter((p) => p.status !== "completed")
        .sort((a, b) => a.end_date.localeCompare(b.end_date));
    const scheduleItems = buildPmSchedule(overdueDeadlines, upcomingDeadlines);
    const scheduleVisible = scheduleItems.slice(0, SCHEDULE_VISIBLE);
    const scheduleOverflow = Math.max(0, scheduleItems.length - SCHEDULE_VISIBLE);
    const dueThisWeek = upcomingDeadlines.filter((item) => isDueWithinDays(item.due_date, 7)).length;
    const overdueCount = overdueDeadlines.length;
    return (<div className="mx-auto w-full max-w-[1200px] space-y-7 pb-2">
      
      <section className="overflow-hidden rounded-[1.25rem] shadow-[0_8px_32px_-12px_rgba(15,23,42,0.28)] ring-1 ring-navy-deep/20">
        <div className="grid lg:grid-cols-[minmax(0,1fr)_auto]">
          <div className="relative bg-linear-to-br from-navy via-[#1e3354] to-navy-deep px-5 py-5 sm:px-6 sm:py-6">
            <div className="pointer-events-none absolute -right-8 top-0 h-32 w-32 rounded-full bg-copper/20 blur-2xl" aria-hidden/>
            <div className="relative">
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-200/85">
                Today
              </p>
              <h1 className="mt-1.5 font-heading text-[1.5rem] font-semibold leading-tight tracking-tight text-white sm:text-[1.65rem]">
                {greetingFor(firstName)}
              </h1>
              <p className="mt-1 text-sm text-slate-300">{formatTodayLong()}</p>
              <Link href={ROUTES.PROJECTS} className={cn(PM_BTN_OUTLINE, "mt-4 h-9 border-white/25 bg-white/10 px-4 text-white hover:border-amber-300/50 hover:bg-white/15 hover:text-white")}>
                <LayoutGrid className="h-4 w-4" strokeWidth={1.75}/>
                Browse all projects
              </Link>
            </div>
          </div>

          <div className="grid grid-cols-3 divide-x divide-slate-200/80 border-t border-slate-200/80 bg-white lg:w-[min(100%,22rem)] lg:border-t-0 lg:border-l">
            <MetricTile icon={FolderKanban} label="Active" value={activeProjects.length} tone="navy"/>
            <MetricTile icon={Timer} label="Due week" value={dueThisWeek} tone={dueThisWeek > 0 ? "copper" : "slate"}/>
            <MetricTile icon={AlertCircle} label="Overdue" value={overdueCount} tone={overdueCount > 0 ? "warn" : "slate"}/>
          </div>
        </div>
      </section>

      <div className="grid items-start gap-7 xl:grid-cols-12">
        <section className="min-w-0 space-y-4 xl:col-span-8">
          <SectionHeader title="Active projects" description={`${activeProjects.length} in delivery — tap a card to open`} action={activeProjects.length > 0 ? (<Link href={ROUTES.PROJECTS} className={PM_LINK_ACTION}>
                  Full directory
                  <ArrowRight className="h-3.5 w-3.5"/>
                </Link>) : null}/>

          {activeProjects.length === 0 ? (<EmptyProjects />) : (<div className="grid gap-4 sm:grid-cols-2">
              {activeProjects.map((project) => (<ProjectCard key={project.id} project={project} progressPct={(() => {
                    const pr = progressByProject[project.id];
                    return pr && pr.total > 0
                        ? Math.round((pr.done / pr.total) * 100)
                        : 0;
                })()}/>))}
            </div>)}
        </section>

        <aside className="min-w-0 space-y-4 xl:col-span-4 xl:sticky xl:top-[4.75rem]">
          <SectionHeader title="Schedule" description={scheduleItems.length > 0
            ? "Tap any row to jump in"
            : "No dated items yet"}/>

          <div className={cn("rounded-[1.25rem] p-2 ring-1 ring-slate-200/90", PM_SURFACE_STATIC, "bg-linear-to-b from-white to-slate-50/80 shadow-[0_4px_20px_-10px_rgba(15,23,42,0.12)]")}>
            {scheduleVisible.length === 0 ? (<div className="cursor-default px-4 py-8 text-center select-none">
                <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-100 text-muted-ink">
                  <CalendarClock className="h-5 w-5" strokeWidth={1.5}/>
                </div>
                <p className="mt-3 text-sm font-semibold text-charcoal">Nothing scheduled</p>
                <p className="mx-auto mt-1 max-w-[220px] text-xs leading-relaxed text-muted-ink">
                  This panel is read-only until you add due dates on milestones or tasks.
                </p>
              </div>) : (<>
                <ul className="space-y-2">
                  {scheduleVisible.map((item) => (<ScheduleRow key={`${item.overdue ? "o" : "u"}-${item.kind}-${item.id}`} item={item} projectTitle={projects.find((p) => p.id === item.project_id)?.title ?? "Project"} href={item.kind === "task"
                    ? projectBoardPath(item.project_id)
                    : projectPath(item.project_id)}/>))}
                </ul>
                {scheduleOverflow > 0 ? (<p className="mt-2 cursor-default px-2 py-1 text-center text-[11px] text-muted-ink select-none">
                    +{scheduleOverflow} more across projects
                  </p>) : null}
              </>)}
          </div>
        </aside>
      </div>
    </div>);
}
function SectionHeader({ title, description, action, }: {
    title: string;
    description: string;
    action?: ReactNode;
}) {
    return (<div className="flex items-end justify-between gap-3">
      <div className="flex items-start gap-2.5">
        <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-copper shadow-[0_0_0_3px_rgba(217,119,6,0.2)]" aria-hidden/>
        <div>
          <h2 className="font-heading text-base font-semibold tracking-tight text-ink sm:text-lg">
            {title}
          </h2>
          <p className="mt-0.5 text-xs text-muted-ink sm:text-[13px]">{description}</p>
        </div>
      </div>
      {action}
    </div>);
}
function MetricTile({ icon: Icon, label, value, tone, }: {
    icon: typeof FolderKanban;
    label: string;
    value: number;
    tone: "navy" | "copper" | "warn" | "slate";
}) {
    const iconWrap = {
        navy: "bg-navy/10 text-navy",
        copper: "bg-copper-soft text-copper",
        warn: "bg-amber-100 text-amber-800",
        slate: "bg-slate-100 text-slate-600",
    }[tone];
    const valueColor = {
        navy: "text-ink",
        copper: "text-copper-hover",
        warn: "text-amber-800",
        slate: "text-ink",
    }[tone];
    return (<div className="flex cursor-default flex-col items-center px-2 py-4 text-center select-none sm:px-3">
      <div className={cn("flex h-9 w-9 items-center justify-center rounded-2xl", iconWrap)}>
        <Icon className="h-4 w-4" strokeWidth={1.75}/>
      </div>
      <dd className={cn("mt-2 font-heading text-2xl font-bold tabular-nums", valueColor)}>
        {value}
      </dd>
      <dt className="mt-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-ink">
        {label}
      </dt>
    </div>);
}
function EmptyProjects() {
    return (<div className={cn("rounded-[1.25rem] border-2 border-dashed border-slate-300/80 px-6 py-12 text-center", PM_SURFACE_STATIC)}>
      <div className="mx-auto flex h-14 w-14 cursor-default items-center justify-center rounded-2xl bg-copper-soft text-copper select-none">
        <Sparkles className="h-6 w-6" strokeWidth={1.5}/>
      </div>
      <h3 className="mt-4 font-heading text-base font-semibold text-ink">No active projects</h3>
      <p className="mx-auto mt-1.5 max-w-xs text-sm text-muted-ink">
        Start an engagement — the button below is your next step.
      </p>
      <Link href={`${ROUTES.PROJECTS}/new`} className={cn(PM_BTN_FILLED, "mt-5 h-10")}>
        <Plus className="h-4 w-4"/>
        Create project
      </Link>
    </div>);
}
function ProjectCard({ project, progressPct, }: {
    project: ProjectWithRelations;
    progressPct: number;
}) {
    const status = (project.status ?? "planning") as ProjectStatus;
    return (<Link href={projectPath(project.id)} aria-label={`Open project: ${project.title}`} className={cn("flex h-full flex-col overflow-hidden rounded-[1.25rem] border-l-[5px] bg-white", PM_PROJECT_STATUS_RAIL[status], PM_CARD_CLICKABLE)}>
      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0 flex-1 space-y-2">
            <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ring-1 ring-inset", PM_PROJECT_STATUS_CHIP[status])}>
              <span className={cn("h-1.5 w-1.5 rounded-full", PM_PROJECT_STATUS_DOT[status])}/>
              {PROJECT_STATUS_LABELS[status]}
            </span>
            <h3 className="line-clamp-2 font-heading text-base font-semibold leading-snug tracking-tight text-ink transition-colors group-hover:text-copper sm:text-[17px]">
              {project.title}
            </h3>
          </div>
          <ProgressRing pct={progressPct}/>
        </div>

        <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-ink">
          <span className="inline-flex min-w-0 max-w-full items-center gap-1.5">
            <UserRound className="h-3.5 w-3.5 shrink-0 text-slate-400"/>
            <span className="truncate">{project.client?.full_name ?? "No client"}</span>
          </span>
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-slate-400"/>
            Ends {formatShortDate(project.end_date)}
          </span>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2 border-t-2 border-slate-100 bg-slate-50/60 px-4 py-2.5 sm:px-5">
        <span className="text-xs font-semibold uppercase tracking-wide text-copper group-hover:text-copper-hover">
          Open project
        </span>
        <span className={PM_ACTION_ORB} aria-hidden>
          <ChevronRight className="h-4 w-4" strokeWidth={2.5}/>
        </span>
      </div>
    </Link>);
}
function ProgressRing({ pct }: {
    pct: number;
}) {
    const size = 46;
    const stroke = 4;
    const radius = (size - stroke) / 2;
    const circumference = 2 * Math.PI * radius;
    const offset = circumference - (pct / 100) * circumference;
    return (<div className="relative shrink-0 cursor-default select-none" style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} className="text-slate-200"/>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="currentColor" strokeWidth={stroke} strokeDasharray={circumference} strokeDashoffset={offset} strokeLinecap="round" className="text-copper"/>
      </svg>
      <span className="absolute inset-0 flex items-center justify-center font-heading text-[10px] font-bold tabular-nums text-ink">
        {pct}%
      </span>
    </div>);
}
function ScheduleRow({ item, projectTitle, href, }: {
    item: PMScheduleItem;
    projectTitle: string;
    href: string;
}) {
    return (<li>
      <Link href={href} aria-label={`Open ${item.kind}: ${item.title}`} className={cn("flex items-center gap-3 p-3", item.overdue ? cn(PM_OVERDUE_ROW, PM_ROW_CLICKABLE) : PM_ROW_CLICKABLE)}>
        <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-xl", item.overdue
            ? PM_OVERDUE_ICON
            : item.kind === "milestone"
                ? "bg-copper-soft text-copper ring-1 ring-copper/25"
                : "bg-slate-100 text-slate-600 ring-1 ring-slate-200/80")}>
          {item.kind === "milestone" ? (<Flag className="h-4 w-4" strokeWidth={1.75}/>) : (<ClipboardList className="h-4 w-4" strokeWidth={1.75}/>)}
        </div>

        <div className="min-w-0 flex-1">
          <p className="truncate text-[11px] font-semibold text-muted-ink">{projectTitle}</p>
          <p className="mt-0.5 line-clamp-1 text-[13px] font-semibold text-charcoal group-hover:text-copper">
            {item.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-1.5">
            <ScheduleMetaBadge item={item} compact/>
            <span className={cn("text-[11px] font-medium tabular-nums", item.overdue ? PM_OVERDUE_TEXT : "text-muted-ink")}>
              {formatWeekday(item.due_date)} · {formatShortDate(item.due_date)}
            </span>
          </div>
        </div>

        <span className={PM_ACTION_ORB} aria-hidden>
          <ChevronRight className="h-4 w-4" strokeWidth={2.5}/>
        </span>
      </Link>
    </li>);
}
function ScheduleMetaBadge({ item, compact, }: {
    item: PMScheduleItem;
    compact?: boolean;
}) {
    if (item.kind === "milestone") {
        return (<span className={cn("inline-flex cursor-default rounded-md border font-semibold select-none", PM_MILESTONE_BADGE, compact ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]")}>
        Milestone
      </span>);
    }
    return (<span className={cn("inline-flex cursor-default rounded-md border font-semibold select-none", priorityBadgeClass(item.priority), compact ? "px-1.5 py-px text-[9px]" : "px-2 py-0.5 text-[10px]")}>
      {TASK_PRIORITY_LABELS[item.priority]}
    </span>);
}
