import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { FlowView } from "@/components/analytics/flow-view";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { dateOf, forecastPhrase, resultPhrase, resultTone, type Forecast, type ProjectRow } from "@/lib/analytics";
import { projectPath, ROUTES } from "@/lib/constants";
import { daysBetween, formatDate, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { PmAnalytics } from "@/services/analytics-service";

const RESULT_TONE = { good: "text-success", neutral: "text-ink-secondary", bad: "text-danger" } as const;
/** On a phone each cell shows its column name above the value. */
const LABEL = "max-md:p-0 max-md:text-left max-md:before:mb-0.5 max-md:before:block max-md:before:text-xs max-md:before:text-ink-tertiary max-md:before:content-[attr(data-label)]";
const TR = "border-t border-line max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-2.5 max-md:px-5 max-md:py-3.5";
const quiet = "px-5 pt-1 pb-5 text-sm text-ink-tertiary sm:px-6";

type Viewer = "pm" | "owner";

/**
 * One project manager's Analytics: how work moves through their projects
 * (Flow), then every project they have handled, planned against actual. The
 * PM sees it as "you"; the owner sees it in third person and cannot open
 * projects or tasks from it.
 */
export function PmAnalyticsView({ data: d, viewer, today }: { data: PmAnalytics; viewer: Viewer; today: string }) {
    const year = today.slice(0, 4);
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", ...(iso.slice(0, 4) === year ? {} : { year: "numeric" }) });
    const total = d.rows.active.length + d.rows.delivered.length;
    const since = d.firstDelivery ? ` since ${formatDate(d.firstDelivery, { month: "long", year: "numeric" })}` : "";
    const counts = <><b>{d.rows.active.length} active</b> · <b>{d.delivered} delivered</b>{since}</>;

    return (<div className="mx-auto w-full max-w-360 pb-12">
      <FlowView data={d.flow} viewer={viewer} firstName={d.pm.firstName} today={today}
        title={viewer === "owner" ? d.pm.name : "Analytics"}
        sub={viewer === "owner" ? <>Project manager · {counts}</> : <>How work moves through your projects · {counts}</>}
        before={viewer === "owner" ? (<Link href={ROUTES.DASHBOARD} className={cn("mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
            <ArrowLeft className="size-4" aria-hidden/>Overview
          </Link>) : null}/>

      <OverviewCard id="projects-heading" title="Projects" sub="Every project handled, planned against actual · status follows each project’s last 4 weeks" aside={<span className="hidden items-center gap-3.5 md:flex">
            <Key swatch="bg-copper" label="Elapsed"/><Key swatch="bg-stage-done" label="Delivered"/><Key swatch="bg-stage-late" label="Beyond plan"/>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded-full bg-ink" aria-hidden/>Planned end</span>
          </span>} className="materialize mt-4" style={stagger(4)}>
        {total === 0 ? <p className={quiet}>No projects yet.</p> : (<table className="w-full text-sm max-md:block">
            <thead className="max-md:sr-only">
              <tr className="text-left text-xs text-ink-tertiary">
                <th className="py-2.5 pr-3 pl-5 font-medium sm:pl-6">Project</th>
                <th className="px-3 font-medium">Planned against actual</th>
                <th className="px-3 font-medium">Result</th>
                <th className="px-3 font-medium">Status</th>
                <th className="px-3 text-right font-medium">Milestones on time</th>
                <th className="pr-5 pl-3 text-right font-medium sm:pr-6">Tasks accepted</th>
              </tr>
            </thead>
            <tbody className="max-md:block">
              {([["Active", d.rows.active], ["Delivered", d.rows.delivered]] as const).map(([label, rows]) => rows.length === 0 ? null : (<Group key={label} label={label}>
                  {rows.map((r) => (<tr key={r.project.id} className={TR}>
                      <td className="py-3.5 pr-3 pl-5 sm:pl-6 max-md:col-span-2 max-md:p-0">
                        {viewer === "pm" ? <Link href={projectPath(r.project.id)} className={cn("font-semibold text-ink hover:text-brand", focusRing)}>{r.project.title}</Link> : <span className="font-semibold text-ink">{r.project.title}</span>}
                        <span className="block text-[12.5px] text-ink-tertiary">{d.clientNames[r.project.id]} · {day(r.project.start_date)} to {day(r.project.end_date)}</span>
                      </td>
                      <td className="w-[28%] px-3 max-md:col-span-2 max-md:w-auto max-md:p-0"><ScheduleBar row={r} today={today}/></td>
                      <td data-label="Result" className={cn("px-3", LABEL, RESULT_TONE[resultTone(r.result)])}>{resultPhrase(r.result)}</td>
                      {r.forecast ? <td data-label="Status" className={cn("px-3", LABEL)}><ForecastCell f={r.forecast} day={day}/></td> : <td className="max-md:hidden"/>}
                      <td data-label="Milestones on time" className={cn("px-3 text-right tabular", LABEL)}>
                        {r.milestones.done > 0 ? <>{r.milestones.onTime} <span className="text-ink-tertiary">of {r.milestones.done}</span></> : <span className="text-ink-tertiary">None yet</span>}
                        {r.milestones.overdue > 0 ? <span className="ml-1.5 rounded-full bg-danger-soft px-2 py-0.5 text-xs font-medium text-danger">{r.milestones.overdue} overdue</span> : null}
                      </td>
                      <td data-label="Tasks accepted" className={cn("pr-5 pl-3 text-right tabular sm:pr-6", LABEL)}>{r.tasks.done} <span className="text-ink-tertiary">of {r.tasks.total}</span></td>
                    </tr>))}
                </Group>))}
            </tbody>
          </table>)}
      </OverviewCard>
    </div>);
}

const FORECAST_TONE: Record<Forecast["kind"], string> = { on_pace: "text-success", late: "text-danger", all_accepted: "text-ink-secondary", no_tasks: "text-ink-tertiary", too_early: "text-ink-tertiary" };

/** When the open tasks should all be accepted at the project's recent pace. Fewer than 3 accepted in 4 weeks is too little to project. */
function ForecastCell({ f, day }: { f: Forecast; day: (iso: string) => string }) {
    return (<span className={FORECAST_TONE[f.kind]}>
      {forecastPhrase(f)}
      {"finish" in f ? <span className="block text-[12.5px] text-ink-tertiary">Done around {day(f.finish)}</span> : null}
    </span>);
}

function Key({ swatch, label }: { swatch: string; label: string }) {
    return <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", swatch)} aria-hidden/>{label}</span>;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (<>
      <tr className="max-md:block"><td colSpan={6} className="border-t border-line bg-surface-subtle py-2 pl-5 text-xs font-semibold text-ink-secondary sm:pl-6 max-md:block">{label}</td></tr>
      {children}
    </>);
}

/** Elapsed (or delivered) time against the planned span: the part beyond the plan in red, a tick at the planned end. */
export function ScheduleBar({ row, today }: { row: ProjectRow; today: string }) {
    const p = row.project;
    const endAt = p.completed_at ? dateOf(p.completed_at) : today;
    const planned = Math.max(1, daysBetween(p.start_date, p.end_date));
    const actual = Math.max(0, daysBetween(p.start_date, endAt));
    const span = Math.max(planned, actual);
    const plannedEnd = (planned / span) * 100;
    const reached = (actual / span) * 100;
    return (<div className="relative h-2.5 min-w-40 rounded-full bg-surface-sunken" role="img" aria-label={`Planned ${plural(planned, "day")}, ${p.completed_at ? "took" : "so far"} ${plural(actual, "day")}`}>
      <span className={cn("absolute inset-y-0 left-0 rounded-l-full", p.completed_at ? "bg-stage-done" : "bg-copper", reached <= plannedEnd && "rounded-r-full")} style={{ width: `${Math.min(reached, plannedEnd)}%` }}/>
      {reached > plannedEnd ? <span className="absolute inset-y-0 rounded-r-full bg-stage-late" style={{ left: `${plannedEnd}%`, width: `${reached - plannedEnd}%` }}/> : null}
      <span className="absolute -inset-y-1 w-0.5 rounded-full bg-ink" style={{ left: `calc(${plannedEnd}% - 1px)` }}/>
    </div>);
}
