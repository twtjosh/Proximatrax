import Link from "next/link";
import { ChevronRight, Inbox } from "lucide-react";
import { CountUp } from "@/components/dashboard/count-up";
import { focusRing, OverviewCard, OverviewHeader, primaryAction, stagger } from "@/components/dashboard/overview-kit";
import { ActivityChart, BarList, ColumnBars, SegmentRing } from "@/components/superadmin/analytics-charts";
import { ROUTES } from "@/lib/constants";
import { formatDate } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { SuperAdminAnalytics } from "@/services/super-admin-analytics-service";

/**
 * The super admin's home. The figures answer "is anything waiting on me?"
 * and "is the platform being used?"; the cards below show how projects and
 * people are spread. Each number appears once.
 */
export function SuperAdminAnalyticsDashboard({ greeting, today, analytics, unopenedInquiries }: {
    greeting: string;
    /** ISO date (Manila). */
    today: string;
    analytics: SuperAdminAnalytics;
    unopenedInquiries: number;
}) {
    const { projects, performance, users, activity, engagement } = analytics;
    const activityTotal = activity.dailyLogins.reduce((s, p) => s + p.count, 0);

    return (<div className="mx-auto w-full max-w-360 pb-12">
      <OverviewHeader title={greeting} sub={formatDate(today, { weekday: "long", month: "long", day: "numeric" })} actions={<Link href={ROUTES.INQUIRIES} className={primaryAction}>
            <Inbox aria-hidden/>
            Open inquiries
          </Link>}/>

      <ul className="mt-8 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <Figure index={1} label="Unopened inquiries" value={unopenedInquiries} detail={`${engagement.totalInquiries} received in all`} href={ROUTES.INQUIRIES} accent={unopenedInquiries > 0}/>
        <Figure index={2} label="People" value={users.total} detail={`${users.active30d} active this month, ${users.new30d} new`} href={ROUTES.SETTINGS}/>
        <Figure index={3} label="Active projects" value={projects.active} detail={`${projects.completed} completed, ${projects.onHold} on hold`}/>
        <Figure index={4} label="Overdue tasks" value={performance.overdueTasks} detail={performance.overdueTasks > 0 ? `${performance.overduePct}% of all tasks` : "Everything on schedule"} danger={performance.overdueTasks > 0}/>
      </ul>

      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_24rem]">
        <OverviewCard id="activity-heading" title="Platform activity" aside="Task updates and messages, last 30 days" className="materialize flex flex-col" style={stagger(5)}>
          <div className="flex gap-8 px-5 pt-2 sm:px-6">
            <Stat label="Events" value={activityTotal}/>
            <Stat label="Files this month" value={performance.filesThisMonth}/>
          </div>
          <ActivityChart points={activity.dailyLogins} className="flex flex-1 flex-col px-5 pt-6 pb-5 sm:px-6"/>
        </OverviewCard>

        <OverviewCard id="projects-heading" title="Projects" count={projects.total} className="materialize" style={stagger(6)}>
          <div className="flex items-center gap-6 px-5 pt-3 sm:px-6">
            <SegmentRing segments={projects.statusDistribution} size={112} stroke={10}>
              <span className="text-2xl font-semibold tracking-[-0.03em] text-ink tabular">{projects.total}</span>
            </SegmentRing>
            <ul className="min-w-0 flex-1 space-y-2">
              {projects.statusDistribution.length === 0 ? <li className="text-sm text-ink-tertiary">No projects yet.</li> : projects.statusDistribution.map((s) => (<li key={s.label} className="flex items-center gap-2.5 text-sm">
                  <span className="size-2 shrink-0 rounded-full" style={{ background: s.color }} aria-hidden/>
                  <span className="flex-1 text-ink-secondary">{s.label}</span>
                  <span className="font-medium text-ink tabular">{s.value}</span>
                </li>))}
            </ul>
          </div>
          <div className="mx-5 mt-6 border-t border-line pt-5 sm:mx-6">
            <p className="text-xs font-medium text-ink-secondary">By share of work accepted</p>
            <div className="mt-3"><ColumnBars items={projects.progressBuckets} unit="project"/></div>
          </div>
          <dl className="mx-5 mt-5 grid grid-cols-2 gap-4 border-t border-line pt-5 pb-6 sm:mx-6">
            <Ratio label="Tasks accepted" pct={performance.taskCompletionPct} count={performance.tasksCompleted}/>
            <Ratio label="Milestones delivered" pct={performance.milestoneCompletionPct} count={performance.milestonesCompleted}/>
          </dl>
        </OverviewCard>
      </div>

      <div className="mt-5 grid items-start gap-5 lg:grid-cols-2">
        <OverviewCard id="roles-heading" title="People by role" aside={<Link href={ROUTES.SETTINGS} className={cn("inline-flex items-center gap-0.5 rounded-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>Manage<ChevronRight className="size-3.5" aria-hidden/></Link>} className="materialize" style={stagger(7)}>
          <div className="px-5 pt-3 pb-6 sm:px-6"><BarList items={users.roleDistribution.map((r) => ({ label: r.label, value: r.value }))} empty="No accounts yet."/></div>
        </OverviewCard>
        <OverviewCard id="active-heading" title="Most active" aside="Task updates, last 30 days" className="materialize" style={stagger(8)}>
          <div className="px-5 pt-3 pb-6 sm:px-6"><BarList items={activity.topUsers.map((u) => ({ id: u.id, label: u.name, sublabel: u.role, value: u.count }))} empty="No task updates in the last 30 days."/></div>
        </OverviewCard>
      </div>
    </div>);
}

/** One headline figure. With an href it opens what it counts. */
function Figure({ index, label, value, detail, href, accent = false, danger = false }: {
    index: number;
    label: string;
    value: number;
    detail: string;
    href?: string;
    /** Copper: something is waiting. */
    accent?: boolean;
    danger?: boolean;
}) {
    const body = (<>
      <span className="flex items-center justify-between gap-2 text-[13px] font-medium text-ink-secondary">
        {label}
        {href ? <ChevronRight className="size-4 text-ink-tertiary transition-[translate,color] duration-500 ease-spring group-hover:translate-x-0.5 group-hover:text-brand" aria-hidden/> : null}
      </span>
      <span className={cn("mt-3 block text-[2.5rem] leading-none font-semibold tracking-[-0.04em] tabular", danger ? "text-danger" : accent ? "text-brand" : "text-ink")}><CountUp value={value} delay={index * 70 + 220}/></span>
      <span className="mt-2 block truncate text-xs text-ink-tertiary">{detail}</span>
    </>);
    const box = "flex w-full min-w-0 flex-col rounded-[20px] material p-5";
    return (<li className="materialize flex min-w-0" style={stagger(index)}>
      {href ? <Link href={href} className={cn(box, "group material-interactive press press-soft", focusRing)}>{body}</Link> : <div className={box}>{body}</div>}
    </li>);
}

function Stat({ label, value }: {
    label: string;
    value: number;
}) {
    return (<div>
      <p className="text-xs text-ink-tertiary">{label}</p>
      <p className="mt-0.5 text-2xl font-semibold tracking-[-0.03em] text-ink tabular">{value}</p>
    </div>);
}

function Ratio({ label, pct, count }: {
    label: string;
    pct: number;
    count: number;
}) {
    return (<div>
      <dt className="text-xs text-ink-tertiary">{label}</dt>
      <dd className="mt-1 flex items-baseline gap-2">
        <span className="text-xl font-semibold tracking-[-0.03em] text-ink tabular">{pct}%</span>
        <span className="text-xs text-ink-tertiary tabular">{count}</span>
      </dd>
      <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
        <div className="h-full rounded-full bg-stage-done" style={{ width: `${pct}%` }}/>
      </div>
    </div>);
}
