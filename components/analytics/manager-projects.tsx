import Link from "next/link";
import { ArrowLeft, ArrowUpRight, FolderOpen } from "lucide-react";
import { asMember } from "@/components/analytics/marks";
import { ScheduleBar } from "@/components/analytics/pm-analytics";
import { Face, focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { dateOf, forecastPhrase, resultPhrase, resultTone, type ProjectRow } from "@/lib/analytics";
import { projectPath, ROUTES } from "@/lib/constants";
import { formatDate, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { ManagerProjects } from "@/services/analytics-service";

const TONE = { good: "text-success", neutral: "text-ink-secondary", bad: "text-danger" } as const;
const FORECAST_TONE = { on_pace: "text-success", late: "text-danger", all_accepted: "text-ink-secondary", no_tasks: "text-ink-tertiary", too_early: "text-ink-tertiary" } as const;

/**
 * The super admin's view of one project manager: every project they run or
 * ran, active first, each planned against actual and opening the project
 * itself to look through.
 */
export function ManagerProjectsView({ data, today }: { data: ManagerProjects; today: string }) {
    const year = today.slice(0, 4);
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", ...(iso.slice(0, 4) === year ? {} : { year: "numeric" }) });
    const { active, delivered } = data.rows;
    return (<div className="mx-auto w-full max-w-360 pb-12">
      <Link href={ROUTES.DASHBOARD} className={cn("mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
        <ArrowLeft className="size-4" aria-hidden/>Overview
      </Link>
      <header className="materialize flex items-center gap-4">
        <Face person={asMember(data.pm)} size={56}/>
        <div className="min-w-0">
          <h1 className="truncate text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">{data.pm.name}</h1>
          <p className="mt-1.5 text-[15px] text-ink-tertiary [&_b]:font-medium [&_b]:text-ink">Project manager · <b>{active.length} active</b> · <b>{delivered.length} completed</b></p>
        </div>
      </header>

      <Group id="active-heading" title="Active projects" rows={active} index={1} empty="No active projects right now." day={day} today={today} clientNames={data.clientNames}/>
      <Group id="completed-heading" title="Completed projects" rows={delivered} index={2} empty="Nothing completed yet." day={day} today={today} clientNames={data.clientNames}/>
    </div>);
}

function Group({ id, title, rows, index, empty, day, today, clientNames }: {
    id: string;
    title: string;
    rows: ProjectRow[];
    index: number;
    empty: string;
    day: (iso: string) => string;
    today: string;
    clientNames: Record<string, string>;
}) {
    return (<OverviewCard id={id} title={title} count={rows.length} sub={rows.length ? "Open a project to look through its tasks, timeline, files and team" : undefined} className="materialize mt-6" style={stagger(index)}>
      {rows.length === 0 ? (<p className="flex items-center gap-2.5 px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6"><FolderOpen className="size-4" aria-hidden/>{empty}</p>) : (<ul className="grid gap-3 px-4 pt-2 pb-4 sm:grid-cols-2 sm:px-5 xl:grid-cols-3">
          {rows.map((r) => <li key={r.project.id}><ProjectCard row={r} client={clientNames[r.project.id]} day={day} today={today}/></li>)}
        </ul>)}
    </OverviewCard>);
}

/** One project: where it stands against its plan, its milestones and tasks; the whole card opens it. */
function ProjectCard({ row: r, client, day, today }: { row: ProjectRow; client: string; day: (iso: string) => string; today: string }) {
    const p = r.project, share = r.tasks.total ? r.tasks.done / r.tasks.total : 0;
    return (<Link href={projectPath(p.id)} className={cn("group flex h-full flex-col gap-3.5 rounded-2xl bg-surface p-4 shadow-[0_0_0_1px_var(--line)] transition-[box-shadow,translate] duration-200 hover:-translate-y-0.5 hover:shadow-[0_0_0_1px_var(--line-strong),0_14px_28px_-18px_rgb(14_18_34/0.35)]", focusRing)}>
      <span className="flex items-start justify-between gap-3">
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-semibold text-ink group-hover:text-brand-hover">{p.title}</span>
          <span className="block truncate text-[12.5px] text-ink-tertiary">{client} · {day(p.start_date)} to {day(p.end_date)}</span>
        </span>
        <ArrowUpRight className="size-4 shrink-0 text-ink-tertiary transition-transform duration-200 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-ink" aria-hidden/>
      </span>
      <ScheduleBar row={r} today={today}/>
      <span className="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1 text-[13px]">
        <span className={cn("font-medium", TONE[resultTone(r.result)])}>{resultPhrase(r.result)}</span>
        {r.forecast ? <span className={FORECAST_TONE[r.forecast.kind]}>{forecastPhrase(r.forecast)}</span> : p.completed_at ? <span className="text-ink-tertiary">Closed {day(dateOf(p.completed_at))}</span> : null}
      </span>
      <span className="mt-auto grid gap-2 border-t border-line pt-3 text-[12.5px] text-ink-secondary">
        <span className="flex items-center gap-2.5">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-sunken"><span className="block h-full rounded-full bg-copper" style={{ width: `${share * 100}%` }}/></span>
          <span className="tabular"><b className="font-semibold text-ink">{r.tasks.done}</b> of {plural(r.tasks.total, "task")} accepted</span>
        </span>
        <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
          {r.milestones.done > 0 ? <span className="tabular">Milestones on time <b className="font-semibold text-ink">{r.milestones.onTime} of {r.milestones.done}</b></span> : <span className="text-ink-tertiary">No milestones delivered yet</span>}
          {r.milestones.overdue > 0 ? <span className="rounded-full bg-danger-soft px-2 text-xs leading-5 font-medium text-danger">{r.milestones.overdue} overdue</span> : null}
        </span>
      </span>
    </Link>);
}
