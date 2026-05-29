import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { BarChart3, ChevronRight, Clock, FileUp, Flag, FolderPlus, Inbox, UserPlus, CheckCircle2, } from "lucide-react";
import { AnalyticsBarChart, AnalyticsHorizontalBars, AnalyticsLineChart, ChartCard, DonutWithLegend, } from "@/components/superadmin/analytics-charts";
import { ProjectProfitOutlook } from "@/components/superadmin/project-profit-outlook";
import { SuperAdminContentFrame } from "@/components/superadmin/super-admin-content-frame";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { SuperAdminAnalytics } from "@/services/super-admin-analytics-service";
function KpiChip({ label, value, tone, }: {
    label: string;
    value: number;
    tone?: "success" | "danger";
}) {
    return (<div className="min-w-0 rounded-md border border-slate-200/90 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
      <p className="truncate text-[9px] font-medium leading-none text-slate-500">{label}</p>
      <p className={cn("mt-1 font-heading text-base font-semibold tabular-nums leading-none", tone === "success" && "text-emerald-600", tone === "danger" && "text-red-600", !tone && "text-slate-950 dark:text-white")}>
        {value}
      </p>
    </div>);
}
type FooterStatTone = "danger" | "success" | "info" | "violet" | "slate";
function FooterStatChip({ icon: Icon, value, label, detail, tone, }: {
    icon: LucideIcon;
    value: string | number;
    label: string;
    detail: string;
    tone: FooterStatTone;
}) {
    const iconTone: Record<FooterStatTone, string> = {
        danger: "text-red-600 bg-red-50 dark:bg-red-950/40",
        success: "text-emerald-600 bg-emerald-50 dark:bg-emerald-950/40",
        info: "text-blue-600 bg-blue-50 dark:bg-blue-950/40",
        violet: "text-violet-600 bg-violet-50 dark:bg-violet-950/40",
        slate: "text-slate-600 bg-slate-100 dark:bg-zinc-800",
    };
    return (<div className="flex h-full min-h-[3.25rem] min-w-0 items-center gap-2 rounded-md border border-slate-200/90 bg-white px-2 py-1.5 dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded", iconTone[tone])}>
        <Icon className="h-3 w-3" strokeWidth={2}/>
      </div>
      <div className="min-w-0 flex-1">
        <p className="font-heading text-sm font-semibold tabular-nums leading-none text-slate-900 dark:text-white">
          {value}
        </p>
        <p className="mt-0.5 truncate text-[9px] font-medium leading-tight text-slate-700 dark:text-zinc-300">
          {label}
        </p>
        <p className="truncate text-[8px] leading-tight text-slate-500">{detail}</p>
      </div>
    </div>);
}
function FooterStatGrid({ children }: {
    children: React.ReactNode;
}) {
    return <div className="grid grid-cols-2 gap-1 [&>*]:h-full">{children}</div>;
}
function KpiGroup({ title, children, className, }: {
    title: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("min-w-0", className)}>
      <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-[#1e3a5f] dark:text-slate-400">
        {title}
      </p>
      <div className="grid grid-cols-4 gap-1">{children}</div>
    </div>);
}
function MetricsPanel({ kpiTitle, kpiChildren, footerTitle, footerChildren, }: {
    kpiTitle: string;
    kpiChildren: React.ReactNode;
    footerTitle: string;
    footerChildren: React.ReactNode;
}) {
    return (<div className="flex min-h-0 min-w-0 flex-col rounded-lg border border-slate-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950/60">
      <div className="p-2">
        <KpiGroup title={kpiTitle}>{kpiChildren}</KpiGroup>
      </div>
      <div className="border-t border-slate-200/80 p-2 dark:border-zinc-800">
        <p className="mb-1 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
          {footerTitle}
        </p>
        {footerChildren}
      </div>
    </div>);
}
export function SuperAdminAnalyticsDashboard({ name, analytics, }: {
    name: string;
    analytics: SuperAdminAnalytics;
}) {
    const { projects, performance, users, activity, engagement } = analytics;
    return (<SuperAdminContentFrame className="max-w-[1440px] space-y-3">
      <header className="flex flex-wrap items-center justify-between gap-x-4 gap-y-2">
        <div className="flex min-w-0 items-center gap-2.5">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-200/90 bg-white dark:border-zinc-800 dark:bg-zinc-950/60">
            <BarChart3 className="h-4 w-4 text-[#1e3a5f] dark:text-slate-300" strokeWidth={1.75}/>
          </div>
          <div className="min-w-0">
            <h1 className="truncate font-heading text-lg font-semibold tracking-tight text-slate-950 dark:text-white">
              Welcome back, {name}
            </h1>
            <p className="text-[10px] text-slate-500">Platform analytics · live data</p>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap gap-1.5">
          <Link href={ROUTES.SETTINGS} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            <UserPlus className="h-3 w-3"/>
            Users
          </Link>
          <Link href={ROUTES.INQUIRIES} className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-rose-200 hover:bg-rose-50 hover:text-rose-800 dark:border-zinc-700 dark:bg-zinc-950 dark:text-zinc-300">
            <Inbox className="h-3 w-3"/>
            Inquiries
            <ChevronRight className="h-2.5 w-2.5 opacity-50"/>
          </Link>
        </div>
      </header>

      <section className="rounded-xl border border-slate-200/90 bg-white p-2.5 shadow-sm ring-1 ring-slate-950/3 sm:p-3 dark:border-zinc-800 dark:bg-zinc-950/40">
        
        <div className="grid gap-2 sm:grid-cols-2 sm:items-stretch">
          <MetricsPanel kpiTitle="Project analytics" footerTitle="Delivery performance" kpiChildren={<>
                <KpiChip label="Total" value={projects.total}/>
                <KpiChip label="Active" value={projects.active} tone="success"/>
                <KpiChip label="Done" value={projects.completed}/>
                <KpiChip label="On hold" value={projects.onHold} tone="danger"/>
              </>} footerChildren={<FooterStatGrid>
                <FooterStatChip icon={Clock} value={performance.overdueTasks} label="Overdue" detail={`${performance.overduePct}% of tasks`} tone="danger"/>
                <FooterStatChip icon={CheckCircle2} value={performance.tasksCompleted} label="Tasks done" detail={`${performance.taskCompletionPct}% rate`} tone="success"/>
                <FooterStatChip icon={Flag} value={performance.milestonesCompleted} label="Milestones" detail={`${performance.milestoneCompletionPct}% rate`} tone="info"/>
                <FooterStatChip icon={FileUp} value={performance.filesThisMonth} label="Uploads" detail="This month" tone="violet"/>
              </FooterStatGrid>}/>

          <MetricsPanel kpiTitle="User analytics" footerTitle="Engagement" kpiChildren={<>
                <KpiChip label="Total" value={users.total}/>
                <KpiChip label="Active 30d" value={users.active30d} tone="success"/>
                <KpiChip label="New 30d" value={users.new30d}/>
                <KpiChip label="Clients" value={users.clients}/>
              </>} footerChildren={<FooterStatGrid>
                <FooterStatChip icon={Inbox} value={engagement.totalInquiries} label="Inquiries" detail="All time" tone="slate"/>
                <FooterStatChip icon={CheckCircle2} value={engagement.projectsCompleted} label="Completed" detail="Projects delivered" tone="success"/>
                <FooterStatChip icon={UserPlus} value={engagement.newUsers30d} label="New users" detail="Last 30 days" tone="info"/>
                <FooterStatChip icon={FolderPlus} value={engagement.newProjects30d} label="New projects" detail="Last 30 days" tone="violet"/>
              </FooterStatGrid>}/>
        </div>

        
        <div className="mt-2 grid gap-1.5 sm:grid-cols-2 xl:grid-cols-4">
          <ChartCard title="Project status" dense>
            <DonutWithLegend segments={projects.statusDistribution}/>
          </ChartCard>
          <ChartCard title="Projects by progress" dense>
            <AnalyticsBarChart items={projects.progressBuckets} dense/>
          </ChartCard>
          <ChartCard title="Users by role" dense>
            <DonutWithLegend segments={users.roleDistribution}/>
          </ChartCard>
          <ChartCard title="User activity" subtitle="30d" dense>
            <AnalyticsLineChart points={activity.dailyLogins} dense/>
          </ChartCard>
        </div>

        
        <div className="mt-2">
          <ChartCard title="Top active users" subtitle="Task updates · 30d" dense>
            <AnalyticsHorizontalBars compact items={activity.topUsers.map((u) => ({
            id: u.id,
            label: u.name,
            sublabel: u.role,
            value: u.count,
        }))}/>
          </ChartCard>
        </div>
      </section>

      <ProjectProfitOutlook />
    </SuperAdminContentFrame>);
}
