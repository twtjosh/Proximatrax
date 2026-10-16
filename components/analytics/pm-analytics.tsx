import Link from "next/link";
import { ArrowLeft, ChevronRight } from "lucide-react";
import { asMember, DeliveryDots } from "@/components/analytics/marks";
import { Face, focusRing, OverviewCard, OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { agePhrase, ageTone, dateOf, resultPhrase, resultTone, type ProjectRow } from "@/lib/analytics";
import { projectPath, projectReviewPath, ROUTES } from "@/lib/constants";
import { daysBetween, formatDate, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { PmAnalytics } from "@/services/analytics-service";

const RESULT_TONE = { good: "text-success", neutral: "text-ink-secondary", bad: "text-danger" } as const;
const AGE_TONE = { late: "text-danger", warn: "text-warning", quiet: "text-ink-tertiary" } as const;
/** On a phone each cell shows its column name above the value. */
const LABEL = "max-md:p-0 max-md:text-left max-md:before:mb-0.5 max-md:before:block max-md:before:text-xs max-md:before:text-ink-tertiary max-md:before:content-[attr(data-label)]";
const TR = "border-t border-line max-md:grid max-md:grid-cols-2 max-md:gap-x-4 max-md:gap-y-2.5 max-md:px-5 max-md:py-3.5";
const quiet = "px-5 pt-1 pb-5 text-sm text-ink-tertiary sm:px-6";

type Viewer = "pm" | "owner";

/**
 * One project manager's record, all time. The PM sees it as "you"; the owner
 * sees the same numbers in third person and cannot open projects from it.
 */
export function PmAnalyticsView({ data: d, viewer, today }: { data: PmAnalytics; viewer: Viewer; today: string }) {
    const year = today.slice(0, 4);
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", ...(iso.slice(0, 4) === year ? {} : { year: "numeric" }) });
    const your = viewer === "pm" ? "your" : `${d.pm.firstName}’s`;
    const total = d.rows.active.length + d.rows.delivered.length;
    const since = d.firstDelivery ? ` since ${formatDate(d.firstDelivery, { month: "long", year: "numeric" })}` : "";
    const counts = <><b>{d.rows.active.length} active</b> · <b>{d.record.delivered} delivered</b>{since}</>;

    return (<div className="mx-auto w-full max-w-360 pb-12">
      {viewer === "owner" ? (<Link href={ROUTES.DASHBOARD} className={cn("mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
          <ArrowLeft className="size-4" aria-hidden/>Overview
        </Link>) : null}
      <OverviewHeader title={viewer === "owner" ? d.pm.name : "Analytics"} sub={viewer === "owner" ? <>Project manager · {counts}</> : <>Every project you have handled · {counts}</>}/>

      <section aria-label="Track record" className="materialize mt-7 overflow-hidden rounded-[20px] material" style={stagger(1)}>
        <div className="grid gap-px bg-line sm:grid-cols-2 xl:grid-cols-4">
          <Cell label="Delivered on time" value={d.record.delivered > 0 ? <>{d.record.onTime} <small>of {d.record.delivered}</small></> : "None yet"}>
            {d.record.delivered > 0 ? (<>
                <DeliveryDots dots={d.dots} size={14}/>
                <p className="mt-2">{d.record.avgLate !== null ? <>The late ones ran <span className="text-danger">{plural(d.record.avgLate, "day")}</span> over on average</> : "Every one on time or early"}</p>
              </>) : <p>Delivered projects appear here.</p>}
          </Cell>
          <Cell label="Milestones on time" value={d.milestones.completed > 0 ? <>{d.milestones.onTime} <small>of {d.milestones.completed}</small></> : "None yet"}>
            {d.milestones.completed > 0 ? (<>
                {/* ponytail: the strip shows the latest 60; a longer record would turn the ticks to hairlines. */}
                <span className="flex h-3.5 gap-0.5" aria-hidden>{d.milestones.ticks.slice(-60).map((t, i) => <span key={i} className={cn("block flex-1 rounded-[2px]", t === "on_time" ? "bg-stage-done" : "bg-stage-review")}/>)}</span>
                <p className="mt-2">{d.milestones.completed - d.milestones.onTime === 0 ? "None delivered late" : `${d.milestones.completed - d.milestones.onTime} delivered after their due date`}</p>
              </>) : <p>Completed milestones appear here.</p>}
          </Cell>
          <Cell label="Tasks" value={<>{d.tasks.ongoing} <small>ongoing</small></>}>
            <p><b className="font-semibold text-ink tabular">{d.tasks.dueSoon}</b> due in the next 14 days</p>
            <p><b className="font-semibold text-ink tabular">{d.tasks.completed}</b> completed in all</p>
          </Cell>
          <Cell label="Behind schedule now" value={<span className={d.behind.length > 0 ? "text-danger" : undefined}>{d.behind.length} <small>of {d.rows.active.length} active</small></span>}>
            {d.behind.length > 0 ? d.behind.map((t) => <p key={t}>{t}</p>) : <p>Everything is on schedule</p>}
          </Cell>
        </div>
      </section>

      <OverviewCard id="projects-heading" title="Projects" count={total} aside={<span className="hidden items-center gap-3.5 md:flex">
            <Key swatch="bg-copper" label="Elapsed"/><Key swatch="bg-stage-done" label="Delivered"/><Key swatch="bg-stage-late" label="Beyond plan"/>
            <span className="inline-flex items-center gap-1.5"><span className="h-3 w-0.5 rounded-full bg-ink" aria-hidden/>Planned end</span>
          </span>} className="materialize mt-5" style={stagger(2)}>
        {total === 0 ? <p className={quiet}>No projects yet.</p> : (<table className="w-full text-sm max-md:block">
            <thead className="max-md:sr-only">
              <tr className="text-left text-xs text-ink-tertiary">
                <th className="py-2.5 pr-3 pl-5 font-medium sm:pl-6">Project</th>
                <th className="px-3 font-medium">Planned against actual</th>
                <th className="px-3 font-medium">Result</th>
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

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <OverviewCard id="crew-heading" title="Crew" count={d.crew.length} aside={`Across ${your} projects, all time`} className="materialize" style={stagger(3)}>
          {d.crew.length === 0 ? <p className={quiet}>No crew has worked on these projects yet.</p> : (<table className="w-full text-sm max-md:block">
              <thead className="max-md:sr-only">
                <tr className="text-left text-xs text-ink-tertiary">
                  <th className="py-2.5 pr-3 pl-5 font-medium sm:pl-6">Crew member</th>
                  <th className="px-3 text-right font-medium">Open</th>
                  <th className="px-3 text-right font-medium">Late now</th>
                  <th className="px-3 text-right font-medium">Finished on time</th>
                  <th className="pr-5 pl-3 text-right font-medium sm:pr-6">Sent back from review</th>
                </tr>
              </thead>
              <tbody className="max-md:block">
                {d.crew.map((c) => {
                    const high = c.submissions > 0 && c.sentBack / c.submissions > 0.12;
                    return (<tr key={c.id} className={TR}>
                    <td className="py-3 pr-3 pl-5 sm:pl-6 max-md:col-span-2 max-md:p-0"><span className="flex items-center gap-2.5 font-medium text-ink"><Face person={asMember(c)} size={26}/>{c.name}</span></td>
                    <td data-label="Open" className={cn("px-3 text-right tabular", LABEL)}>{c.open}</td>
                    <td data-label="Late now" className={cn("px-3 text-right tabular", LABEL, c.late > 0 ? "text-danger" : "text-ink-tertiary")}>{c.late > 0 ? c.late : "None"}</td>
                    <td data-label="Finished on time" className={cn("px-3 text-right tabular", LABEL)}>{c.finishedOnTime} <span className="text-ink-tertiary">of {c.finished}</span></td>
                    <td data-label="Sent back from review" className={cn("pr-5 pl-3 text-right tabular sm:pr-6", LABEL)}>
                      <span className="inline-flex items-center gap-2">
                        <span className={high ? "text-danger" : undefined}>{c.sentBack} <span className="text-ink-tertiary">of {c.submissions}</span></span>
                        <span className="h-1.5 w-14 overflow-hidden rounded-full bg-surface-sunken" aria-hidden><span className="block h-full rounded-full bg-stage-late" style={{ width: `${c.submissions > 0 ? (c.sentBack / c.submissions) * 100 : 0}%` }}/></span>
                      </span>
                    </td>
                  </tr>);
                })}
              </tbody>
            </table>)}
        </OverviewCard>

        <OverviewCard id="waiting-heading" title={`Waiting for ${your} review`} count={d.waiting.length} className="materialize" style={stagger(4)}>
          <p className="px-5 pt-0.5 pb-4 text-sm leading-relaxed text-ink-secondary sm:px-6 [&_b]:font-semibold [&_b]:text-ink">
            {d.turnaround !== null
                ? <>Over the last 90 days {viewer === "pm" ? "you" : d.pm.firstName} took <b>{d.turnaround} days</b> on average to accept or send back a submission.</>
                : "No submission was reviewed in the last 90 days."}
          </p>
          {d.waiting.length === 0 ? <p className={quiet}>Nothing is waiting for review.</p> : (<ul className="pb-1.5">
              {d.waiting.map((w) => {
                  const body = (<>
                    <span className="min-w-0">
                      <span className="block truncate text-[13.5px] font-medium text-ink">{w.task.title}</span>
                      <span className="block truncate text-xs text-ink-tertiary">{w.projectTitle}{w.crewName ? ` · ${w.crewName}` : ""}</span>
                    </span>
                    <span className={cn("text-[12.5px] font-semibold whitespace-nowrap tabular", AGE_TONE[ageTone(w.days)])}>{agePhrase(w.days)}</span>
                    {viewer === "pm" ? <ChevronRight className="size-4 text-ink-tertiary" aria-hidden/> : null}
                  </>);
                  const row = "grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-3 border-t border-line px-5 py-2.5 sm:px-6";
                  return (<li key={w.task.id}>
                    {viewer === "pm" ? <Link href={`${projectReviewPath(w.task.project_id)}?task=${w.task.id}`} className={cn(row, "transition-colors hover:bg-surface-subtle", focusRing)}>{body}</Link> : <div className={row}>{body}</div>}
                  </li>);
              })}
            </ul>)}
        </OverviewCard>
      </div>
    </div>);
}

function Cell({ label, value, children }: { label: string; value: React.ReactNode; children: React.ReactNode }) {
    return (<div className="min-w-0 bg-surface px-5 py-5 sm:px-6">
      <p className="text-[12.5px] text-ink-tertiary">{label}</p>
      <p className="mt-1.5 mb-2.5 text-[30px] leading-[1.1] font-semibold tracking-[-0.03em] text-ink tabular [&_small]:text-[15px] [&_small]:font-medium [&_small]:tracking-[-0.01em] [&_small]:text-ink-tertiary">{value}</p>
      <div className="text-[12.5px] text-ink-secondary">{children}</div>
    </div>);
}

function Key({ swatch, label }: { swatch: string; label: string }) {
    return <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", swatch)} aria-hidden/>{label}</span>;
}

function Group({ label, children }: { label: string; children: React.ReactNode }) {
    return (<>
      <tr className="max-md:block"><td colSpan={5} className="border-t border-line bg-surface-subtle py-2 pl-5 text-xs font-semibold text-ink-secondary sm:pl-6 max-md:block">{label}</td></tr>
      {children}
    </>);
}

/** Elapsed (or delivered) time against the planned span: the part beyond the plan in red, a tick at the planned end. */
function ScheduleBar({ row, today }: { row: ProjectRow; today: string }) {
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
