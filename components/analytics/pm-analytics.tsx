import Link from "next/link";
import { AlertTriangle, ArrowLeft, CheckCircle2, CircleDashed, Clock3, Flag, Inbox, ListChecks, TrendingDown, TrendingUp } from "lucide-react";
import { ActivitySummary } from "@/components/analytics/activity-summary";
import { FlowView } from "@/components/analytics/flow-view";
import { Meter } from "@/components/analytics/meter";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { dateOf, type ProjectRow } from "@/lib/analytics";
import { headlines, PACE_LABEL, PACE_TONE, paceSentence, projectPace, ratio, type Pace, type PaceState } from "@/lib/analytics-insights";
import { projectPath, ROUTES } from "@/lib/constants";
import { daysBetween, formatDate, plural } from "@/lib/dashboard";
import { phaseSummary } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";
import type { PmAnalytics } from "@/services/analytics-service";

type Viewer = "pm" | "owner";
const TONE_PILL = { good: "bg-success-soft text-success", warn: "bg-warning-soft text-warning", bad: "bg-danger-soft text-danger", quiet: "bg-surface-sunken text-ink-secondary" } as const;
const PACE_ICON: Record<PaceState, typeof Clock3> = {
    not_started: CircleDashed, no_tasks: CircleDashed, on_pace: CheckCircle2, behind: TrendingDown, ahead: TrendingUp,
    past_end: AlertTriangle, delivered_on_time: Flag, delivered_late: Flag,
};

/**
 * One project manager's Analytics, read top down: what it all means in a few
 * sentences, the four numbers behind that, then each project's work accepted
 * against time used. The timeline, throughput, workload and activity follow.
 * The PM sees it as "you"; the owner sees it in third person, without links.
 */
export function PmAnalyticsView({ data: d, viewer, today }: { data: PmAnalytics; viewer: Viewer; today: string }) {
    const pm = viewer === "pm";
    const since = d.firstDelivery ? ` since ${formatDate(d.firstDelivery, { month: "long", year: "numeric" })}` : "";
    const counts = <><b>{d.rows.active.length} active</b> · <b>{d.delivered} delivered</b>{since}</>;
    const tasksOf = (id: string) => d.flow.tasks.filter((t) => t.project_id === id);
    const paced = (rows: ProjectRow[]) => rows.map((r) => ({ row: r, pace: projectPace(r.project, tasksOf(r.project.id), today) }));
    const active = paced(d.rows.active), delivered = paced(d.rows.delivered);

    const activeIds = new Set(d.rows.active.map((r) => r.project.id));
    const openTasks = d.flow.tasks.filter((t) => activeIds.has(t.project_id));
    const isLate = (t: { stage: string; due_date: string | null }) => t.stage !== "done" && t.stage !== "review" && t.due_date !== null && t.due_date < today;
    const crew = d.flow.crew.map((p) => {
        const mine = openTasks.filter((t) => t.assigned_to === p.id && t.stage !== "done");
        return { name: p.name, open: mine.length, late: mine.filter(isLate).length };
    });
    const review = openTasks.filter((t) => t.stage === "review").length;
    const lines = headlines({ projects: active.map((a) => ({ title: a.row.project.title, pace: a.pace })), review, crew, whose: pm ? "your" : "their" });

    const lead = (<>
      <section aria-label="In short" className="materialize mt-6 rounded-[20px] bg-ink px-6 py-5 text-canvas sm:px-7" style={stagger(1)}>
        <ul className="grid gap-1.5">
          {lines.map((l, i) => (<li key={i} className={cn("text-pretty", i === 0 ? "text-[19px] leading-snug font-semibold tracking-[-0.01em]" : "text-[14.5px] leading-relaxed text-canvas/75")}>{l}</li>))}
        </ul>
      </section>
      <Numbers d={d} today={today} openTasks={openTasks} review={review} isLate={isLate} pm={pm}/>
      <OverviewCard id="projects-heading" title="Projects" sub="Work accepted against time used. When the work bar is shorter than the time bar, the project is falling behind." className="materialize mt-4" style={stagger(3)}>
        {active.length + delivered.length === 0 ? <p className="px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6">No projects yet.</p> : (<div className="pb-2">
            {([["Active", active], ["Delivered", delivered]] as const).map(([label, rows]) => rows.length === 0 ? null : (<section key={label} aria-label={`${label} projects`}>
                <h3 className="border-t border-line bg-surface-subtle px-5 py-2 text-xs font-semibold text-ink-secondary sm:px-6">{label} · {rows.length}</h3>
                <ul>{rows.map(({ row, pace }) => <ProjectItem key={row.project.id} row={row} pace={pace} client={d.clientNames[row.project.id]} link={pm} today={today}/>)}</ul>
              </section>))}
          </div>)}
      </OverviewCard>
    </>);

    return (<div className="mx-auto w-full max-w-360 pb-12">
      <FlowView data={d.flow} viewer={viewer} firstName={d.pm.firstName} today={today}
        title={viewer === "owner" ? d.pm.name : "Analytics"}
        sub={viewer === "owner" ? <>Project manager · {counts}</> : <>How your projects are doing · {counts}</>}
        before={viewer === "owner" ? (<Link href={ROUTES.DASHBOARD} className={cn("mb-2.5 inline-flex items-center gap-1.5 text-[13px] font-medium text-ink-tertiary hover:text-ink", focusRing)}>
            <ArrowLeft className="size-4" aria-hidden/>Overview
          </Link>) : null}
        lead={lead}/>
      {pm ? <ActivitySummary log={d.flow.timeline.log} people={d.flow.timeline.people} projects={d.flow.projects} today={today}/> : null}
    </div>);
}

/** The four numbers the summary rests on, each with what it means. */
function Numbers({ d, today, openTasks, review, isLate, pm }: {
    d: PmAnalytics;
    today: string;
    openTasks: PmAnalytics["flow"]["tasks"];
    review: number;
    isLate: (t: { stage: string; due_date: string | null }) => boolean;
    pm: boolean;
}) {
    const accepted = ratio(openTasks.filter((t) => t.stage === "done").length, openTasks.length);
    const activeIds = new Set(d.rows.active.map((r) => r.project.id));
    const ph = phaseSummary(d.flow.timeline.milestones.filter((m) => activeIds.has(m.project_id)), today);
    const overdue = openTasks.filter(isLate).length;
    const tile = "flex min-w-0 flex-col gap-2 rounded-2xl bg-surface px-4 py-4 shadow-[0_0_0_1px_var(--line)]";
    const head = "flex items-center gap-2 text-[13px] font-medium text-ink-secondary [&_svg]:size-4 [&_svg]:text-ink-tertiary";
    const note = "text-[12.5px] leading-snug text-ink-tertiary";
    return (<section aria-label="The numbers behind it" className="materialize mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4" style={stagger(2)}>
      <div className={tile}>
        <span className={head}><ListChecks aria-hidden/>Tasks accepted</span>
        <Meter value={accepted} unit="tasks"/>
        <span className={note}>Across the active projects. Only work you accept counts as done.</span>
      </div>
      <div className={tile}>
        <span className={head}><Flag aria-hidden/>Milestones delivered</span>
        <Meter value={ratio(ph.delivered, ph.rows.length)} unit="milestones"/>
        <span className={note}>
          {ph.missed ? <span className="font-medium text-danger">{plural(ph.missed, "milestone")} missed. </span> : null}
          {ph.next ? `Next: ${ph.next.title}, due ${formatDate(ph.next.due, { month: "short", day: "numeric" })}.` : ph.rows.length ? "Nothing left to deliver." : "No milestones on active projects."}
        </span>
      </div>
      <div className={tile}>
        <span className={head}><Clock3 aria-hidden/>Overdue tasks</span>
        <span className={cn("text-[28px] leading-none font-semibold tabular", overdue ? "text-danger" : "text-ink")}>{overdue}</span>
        <span className={note}>{overdue ? "Open work past its due date. Each one delays its milestone." : "Every open task is within its due date."}</span>
      </div>
      <div className={tile}>
        <span className={head}><Inbox aria-hidden/>Waiting for review</span>
        <span className="text-[28px] leading-none font-semibold text-ink tabular">{review}</span>
        <span className={note}>{review ? `Submitted by the crew and waiting on ${pm ? "you" : "the project manager"} to accept or send back.` : `Nothing is waiting on ${pm ? "you" : "the project manager"}.`}</span>
      </div>
    </section>);
}

/** One project: its pace in a pill, work accepted and time used as two exact meters, and a sentence saying what they mean. */
function ProjectItem({ row, pace, client, link, today }: { row: ProjectRow; pace: Pace; client?: string; link: boolean; today: string }) {
    const p = row.project, tone = PACE_TONE[pace.state], Icon = PACE_ICON[pace.state];
    const year = today.slice(0, 4);
    const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", ...(iso.slice(0, 4) === year ? {} : { year: "numeric" }) });
    const ms = row.milestones;
    const facts = [
        pace.overdue ? <span key="o" className="font-medium text-danger">{plural(pace.overdue, "task")} overdue</span> : null,
        ms.overdue ? <span key="m" className="font-medium text-danger">{plural(ms.overdue, "milestone")} overdue</span> : null,
        ms.done ? <span key="t">{ms.onTime} of {ms.done} milestones on time</span> : null,
    ].filter(Boolean);
    return (<li className="grid gap-x-8 gap-y-3 border-t border-line px-5 py-4 first:border-t-0 sm:px-6 lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_minmax(0,17rem)] lg:items-center">
      <div className="min-w-0">
        {link ? <Link href={projectPath(p.id)} className={cn("font-semibold break-words text-ink hover:text-brand", focusRing)}>{p.title}</Link> : <span className="font-semibold break-words text-ink">{p.title}</span>}
        <span className="block text-[12.5px] text-ink-tertiary">{client ? `${client} · ` : ""}{day(p.start_date)} to {day(p.end_date)}{p.completed_at ? ` · handed over ${day(dateOf(p.completed_at))}` : ""}</span>
      </div>
      <div className="grid min-w-0 gap-2">
        <Meter label="Work accepted" value={pace.work} unit="tasks"/>
        <Meter label="Time used" value={pace.time} unit="days" fill={pace.state === "past_end" ? "bg-danger" : "bg-ink-tertiary/55"}/>
      </div>
      <div className="grid min-w-0 gap-1.5">
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", TONE_PILL[tone])}><Icon className="size-3.5" aria-hidden/>{PACE_LABEL[pace.state]}</span>
        <p className="text-[13px] leading-snug text-pretty text-ink-secondary">{paceSentence(pace)}</p>
        {facts.length ? <p className="flex flex-wrap gap-x-2 text-[12.5px] text-ink-tertiary">{facts.map((f, i) => <span key={i}>{i ? "· " : ""}{f}</span>)}</p> : null}
      </div>
    </li>);
}

/** Elapsed (or delivered) time against the planned span: the part beyond the plan in red, a tick at the planned end. Used by the owner's overview. */
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

