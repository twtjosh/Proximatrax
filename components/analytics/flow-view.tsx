"use client";
import * as React from "react";
import { ChartLine, Table2 } from "lucide-react";
import { AreaChart, spanLabel } from "@/components/analytics/flow-charts";
import { asMember } from "@/components/analytics/marks";
import { ProjectTimeline, Segmented } from "@/components/analytics/timeline/project-timeline";
import { Face, focusRing, OverviewCard, OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { openLoad, type Person, type TaskMove } from "@/lib/analytics";
import { daysBetween, isoDateIn } from "@/lib/dashboard";
import { daysPerTask, openNow, scopeFlow, spans, throughput, type FlowPhase, type FlowTask, type Grain } from "@/lib/flow";
import type { TimelineData } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";

export type FlowData = {
    tasks: FlowTask[];
    moves: TaskMove[];
    phases: FlowPhase[];
    projects: { id: string; title: string; active: boolean }[];
    crew: Person[];
    timeline: TimelineData;
};
type Viewer = "pm" | "owner";
/** Throughput and Workload look back over the chosen grain's spans, so the chart adds up to its summary. */
const GRAINS: { value: Grain; label: string; range: string }[] = [
    { value: "day", label: "Daily", range: "Last 14 days, day by day" },
    { value: "week", label: "Weekly", range: "Last 12 weeks, week by week" },
    { value: "month", label: "Monthly", range: "Last 12 months, month by month" },
];

/**
 * The Analytics page's Flow: how work moves through a manager's projects.
 * The project timeline (one project, week by week, with its own project
 * picker), then throughput (added against accepted) and workload across all
 * of them, daily, weekly or monthly, side by side at one height. Every count is
 * worked out in the browser from the raw rows.
 */
export function FlowView({ data, viewer, today, title, sub, before }: {
    data: FlowData;
    viewer: Viewer;
    firstName: string;
    /** ISO date (Manila). */
    today: string;
    title: React.ReactNode;
    sub: React.ReactNode;
    /** Rendered above the header (the owner's back link). */
    before?: React.ReactNode;
}) {
    const [table, setTable] = React.useState(false);
    const [grain, setGrain] = React.useState<Grain>("week");
    const root = React.useRef<HTMLDivElement>(null);

    const ss = React.useMemo(() => spans(today, grain), [today, grain]);
    const tp = React.useMemo(() => throughput(data.tasks, ss), [data.tasks, ss]);
    const from = ss[0].start, windowDays = daysBetween(from, today) + 1;

    // Workload: everyone's open work.
    const workload = React.useMemo(() => {
        const team = daysPerTask(data.tasks, data.moves, today, windowDays);
        const rows = data.crew.map((p) => {
            const mine = scopeFlow(data.tasks, data.moves, (t) => t.assigned_to === p.id);
            const open = openNow(mine.tasks, mine.moves, today).map((l) => l.length);
            const inPeriod = mine.moves.filter((m) => isoDateIn(m.at) >= from);
            const submitted = inPeriod.filter((m) => m.to === "review").length, back = inPeriod.filter((m) => m.from === "review" && m.to === "in_progress").length;
            return { person: p, open, late: openLoad(mine.tasks, today).late, pace: daysPerTask(mine.tasks, mine.moves, today, windowDays), submitted, back };
        }).filter((r) => r.open.some(Boolean) || r.submitted > 0);
        const maxOpen = Math.max(1, ...rows.map((r) => r.open[0] + r.open[1] + r.open[2]));
        const worst = rows.filter((r) => r.submitted >= 3 && r.back / r.submitted > 0.12).sort((a, b) => b.back / b.submitted - a.back / a.submitted)[0]?.person.id;
        const total = rows.reduce((t, r) => ({ open: t.open + r.open[0] + r.open[1] + r.open[2], late: t.late + r.late, review: t.review + r.open[2] }), { open: 0, late: 0, review: 0 });
        return { team, rows, maxOpen, worst, total };
    }, [data.tasks, data.moves, data.crew, today, from, windowDays]);

    const timeline = <ProjectTimeline data={data.timeline} tasks={data.tasks} moves={data.moves} viewer={viewer} today={today}/>;
    if (data.tasks.length === 0) {
        return (<div ref={root}>
          {before}
          <OverviewHeader title={title} sub={sub}/>
          {timeline}
        </div>);
    }

    const sum = (xs: number[]) => xs.reduce((a, b) => a + b, 0);
    const added = sum(tp.added), accepted = sum(tp.accepted), net = added - accepted;
    const g = GRAINS.find((x) => x.value === grain)!;
    const whose = viewer === "pm" ? "your" : "their";

    return (<div ref={root} className="relative scroll-mt-6">
      {before}
      <OverviewHeader title={title} sub={sub}/>

      {timeline}

      <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
        <p className="text-[13.5px] font-medium text-ink-secondary">{g.range}</p>
        <Segmented label="Monitor" value={grain} onChange={(v) => setGrain(v as Grain)} options={GRAINS}/>
      </div>

      <div className="mt-3 grid items-stretch gap-4 lg:grid-cols-2">
        {/* Throughput */}
        <OverviewCard id="throughput-heading" title="Throughput" sub={`Tasks added and accepted each ${grain}`} className="materialize flex flex-col [&>div:first-child]:min-h-[74px]" style={stagger(2)} aside={<div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-ink-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-copper" aria-hidden/>Accepted</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-[color:var(--series-2)]" aria-hidden/>Added</span>
            <button type="button" aria-pressed={table} onClick={() => setTable((v) => !v)} className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-full bg-surface-sunken px-3 font-medium hover:text-ink", focusRing)}>{table ? <><ChartLine className="size-3.5" aria-hidden/>Chart</> : <><Table2 className="size-3.5" aria-hidden/>Table</>}</button>
          </div>}>
          <p className="px-5 pt-1 text-[13.5px] text-ink-secondary sm:px-6">
            <b className="font-semibold text-ink tabular">{added}</b> added · <b className="font-semibold text-ink tabular">{accepted}</b> accepted · {net === 0 ? "open work unchanged" : <>open work {net > 0 ? "up" : "down"} <b className="font-semibold text-ink tabular">{Math.abs(net)}</b></>}
          </p>
          {/* The table scrolls inside the chart's space, so switching views never changes the card's height. */}
          <div className="relative flex min-h-56 flex-1 flex-col justify-center px-4 pt-4 pb-5 sm:px-5">
            {table ? (<div tabIndex={0} aria-label={`${g.label} throughput table`} className={cn("absolute inset-x-4 top-4 bottom-5 overflow-y-auto overscroll-contain rounded-xl shadow-[inset_0_0_0_1px_var(--line)] [scrollbar-width:thin] sm:inset-x-5", focusRing)}>
                <table className="w-full text-[13px] tabular">
                  <thead className="sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_var(--line)]"><tr className="text-left text-ink-tertiary"><th className="px-3 py-2 font-medium capitalize">{grain}</th><th className="px-3 py-2 text-right font-medium">Added</th><th className="px-3 py-2 text-right font-medium">Accepted</th></tr></thead>
                  <tbody>{ss.map((sp, i) => <tr key={sp.start} className="border-t border-line first:border-t-0 hover:bg-surface-subtle"><td className="px-3 py-1.5">{spanLabel(sp, grain)}</td><td className="px-3 py-1.5 text-right">{tp.added[i]}</td><td className="px-3 py-1.5 text-right">{tp.accepted[i]}</td></tr>)}</tbody>
                </table>
              </div>) : <AreaChart accepted={tp.accepted} added={tp.added} spans={ss} grain={grain}/>}
          </div>
        </OverviewCard>

        {/* Workload */}
        <OverviewCard id="workload-heading" title="Workload" sub={workload.team === null ? "Open tasks per person" : `Open tasks per person · days per task against the team’s ${workload.team}`} className="materialize flex flex-col [&>div:first-child]:min-h-[74px]" style={stagger(3)} aside={<span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-todo" aria-hidden/>To do</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-progress" aria-hidden/>In progress</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-review" aria-hidden/>In review</span>
          </span>}>
          <p className="px-5 pt-1 text-[13.5px] text-ink-secondary sm:px-6">
            <b className="font-semibold text-ink tabular">{workload.total.open}</b> open {workload.total.open === 1 ? "task" : "tasks"} · {workload.total.late ? <><b className="font-semibold text-danger tabular">{workload.total.late}</b> late</> : "none late"} · <b className="font-semibold text-ink tabular">{workload.total.review}</b> waiting for {whose} review
          </p>
          {workload.rows.length === 0 ? <p className="px-5 pt-3 pb-6 text-sm text-ink-tertiary sm:px-6">No crew has open work.</p> : (<div className="grid content-start gap-0.5 px-3 pt-2 pb-3.5">
              {workload.rows.map((r) => {
                    const [a, b, c] = r.open, slow = r.pace !== null && workload.team !== null && r.pace > workload.team + 0.5;
                    return (<div key={r.person.id} className="grid grid-cols-[minmax(0,1fr)_76px] items-center gap-x-3.5 gap-y-2 rounded-xl px-2.5 py-2 transition-colors hover:bg-surface-subtle sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_76px]">
                      <span className="flex min-w-0 items-center gap-2.5">
                        <Face person={asMember(r.person)} size={28}/>
                        <span className="min-w-0"><span className="block truncate text-[13px] font-semibold">{r.person.name}</span>
                          <span className="flex flex-wrap gap-1">{r.late ? <span className="rounded-full bg-danger-soft px-1.5 text-[11.5px] font-semibold text-danger">{r.late} late</span> : null}{workload.worst === r.person.id ? <span className="rounded-full bg-warning-soft px-1.5 text-[11.5px] font-semibold text-warning">Most rework</span> : null}</span>
                        </span>
                      </span>
                      <span className="col-span-2 flex h-[22px] gap-0.5 max-sm:row-start-2 sm:col-span-1" style={{ width: `${Math.max(8, ((a + b + c) / workload.maxOpen) * 100)}%` }} data-tip={`${r.person.name}\n${a} to do · ${b} in progress · ${c} in review`}>
                        {a ? <i className="chart-widen grid min-w-[18px] place-items-center rounded-[5px] bg-stage-todo text-[11px] font-bold text-ink not-italic tabular" style={{ flex: a }}>{a}</i> : null}
                        {b ? <i className="chart-widen grid min-w-[18px] place-items-center rounded-[5px] bg-stage-progress text-[11px] font-bold text-ink not-italic tabular" style={{ flex: b }}>{b}</i> : null}
                        {c ? <i className="chart-widen grid min-w-[18px] place-items-center rounded-[5px] bg-stage-review text-[11px] font-bold text-ink not-italic tabular" style={{ flex: c }}>{c}</i> : null}
                      </span>
                      <span className={cn("text-right text-[13px] leading-tight font-semibold tabular max-sm:col-start-2 max-sm:row-start-1", slow && "text-danger")}>{r.pace === null ? "–" : `${r.pace} d`}<small className="block text-[11.5px] font-medium text-ink-tertiary">per task</small></span>
                    </div>);
                })}
            </div>)}
        </OverviewCard>
      </div>
      <Tooltip root={root}/>
    </div>);
}

/** The page's hover tooltip: reads `data-tip` ("Title\nline\nline") from whatever is under the pointer. Only this re-renders on move. */
function Tooltip({ root }: { root: React.RefObject<HTMLDivElement | null> }) {
    const [tip, setTip] = React.useState<{ x: number; y: number; lines: string[] } | null>(null);
    React.useEffect(() => {
        const el = root.current;
        if (!el) return;
        const move = (e: PointerEvent) => {
            const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tip]");
            setTip(t?.dataset.tip ? { x: e.clientX, y: e.clientY, lines: t.dataset.tip.split("\n") } : null);
        };
        const leave = () => setTip(null);
        el.addEventListener("pointermove", move);
        el.addEventListener("pointerleave", leave);
        return () => {
            el.removeEventListener("pointermove", move);
            el.removeEventListener("pointerleave", leave);
        };
    }, [root]);
    if (!tip) return null;
    const left = Math.min(tip.x + 14, window.innerWidth - 276), above = tip.y > 90;
    return (<div role="presentation" className={cn("pointer-events-none fixed z-50 max-w-[260px] rounded-[10px] bg-rail px-3 py-2 text-xs leading-[1.45] text-rail-ink-secondary shadow-[0_12px_28px_-8px_rgb(11_14_26/0.5)]", above && "-translate-y-full")} style={{ left, top: above ? tip.y - 12 : tip.y + 18 }}>
      <b className="block font-semibold text-rail-ink">{tip.lines[0]}</b>
      {tip.lines.slice(1).map((l, i) => <span key={i} className="block">{l}</span>)}
    </div>);
}
