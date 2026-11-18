"use client";
import * as React from "react";
import { AlertTriangle, ChartColumn, CheckCircle2, Minus, Scale, Table2, TrendingDown, TrendingUp } from "lucide-react";
import { WeekColumns, weekRange } from "@/components/analytics/flow-charts";
import { asMember } from "@/components/analytics/marks";
import { ProjectTimeline } from "@/components/analytics/timeline/project-timeline";
import { Face, focusRing, OverviewCard, OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { openLoad, toMoves, type Person } from "@/lib/analytics";
import { throughputFacts, type ThroughputFacts } from "@/lib/analytics-insights";
import { addDays, isoDateIn, plural } from "@/lib/dashboard";
import { daysPerTask, flowSummary, openNow, readiness, scopeFlow, type FlowPhase, type FlowTask } from "@/lib/flow";
import type { TimelineData } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";

export type FlowData = {
    tasks: FlowTask[];
    phases: FlowPhase[];
    projects: { id: string; title: string; active: boolean }[];
    crew: Person[];
    timeline: TimelineData;
};
type Viewer = "pm" | "owner";
/** Throughput and Workload look back this many whole weeks, so the weekly chart adds up to its summary. */
const WEEKS = 12;

/**
 * The Analytics page's Flow: how work moves through a manager's projects.
 * The project timeline (one project, week by week, with its own project
 * picker), then throughput (added against accepted) and workload across all
 * of them over the last 12 weeks, side by side at one height. Every count is
 * worked out in the browser from the raw rows.
 */
export function FlowView({ data, viewer, today, title, sub, before, lead }: {
    data: FlowData;
    viewer: Viewer;
    firstName: string;
    /** ISO date (Manila). */
    today: string;
    title: React.ReactNode;
    sub: React.ReactNode;
    /** Rendered above the header (the owner's back link). */
    before?: React.ReactNode;
    /** Rendered under the header, above the timeline (the PM's at-a-glance row). */
    lead?: React.ReactNode;
}) {
    const [table, setTable] = React.useState(false);
    const root = React.useRef<HTMLDivElement>(null);
    const moves = React.useMemo(() => toMoves(data.timeline.log.filter((r) => r.action_type === "task_moved")), [data.timeline.log]);

    // From every task: a phase opens only when all of its tasks are accepted, whoever they belong to.
    const ready = React.useMemo(() => readiness(data.tasks, data.phases, today), [data.tasks, data.phases, today]);
    const s = React.useMemo(() => flowSummary(data.tasks, moves, today, WEEKS, ready), [data.tasks, moves, today, ready]);

    // Workload: everyone's open work.
    const workload = React.useMemo(() => {
        const from = addDays(today, 1 - WEEKS * 7);
        const team = daysPerTask(data.tasks, moves, today, WEEKS * 7);
        const rows = data.crew.map((p) => {
            const mine = scopeFlow(data.tasks, moves, (t) => t.assigned_to === p.id);
            const open = openNow(mine.tasks, mine.moves, today).map((l) => l.length);
            const inPeriod = mine.moves.filter((m) => isoDateIn(m.at) >= from);
            const submitted = inPeriod.filter((m) => m.to === "review").length, back = inPeriod.filter((m) => m.from === "review" && m.to === "in_progress").length;
            return { person: p, open, late: openLoad(mine.tasks, today).late, pace: daysPerTask(mine.tasks, mine.moves, today, WEEKS * 7), submitted, back };
        }).filter((r) => r.open.some(Boolean) || r.submitted > 0);
        const maxOpen = Math.max(1, ...rows.map((r) => r.open[0] + r.open[1] + r.open[2]));
        const worst = rows.filter((r) => r.submitted >= 3 && r.back / r.submitted > 0.12).sort((a, b) => b.back / b.submitted - a.back / a.submitted)[0]?.person.id;
        const total = rows.reduce((t, r) => ({ open: t.open + r.open[0] + r.open[1] + r.open[2], late: t.late + r.late, review: t.review + r.open[2] }), { open: 0, late: 0, review: 0 });
        return { team, rows, maxOpen, worst, total };
    }, [data.tasks, moves, data.crew, today]);

    const timeline = <ProjectTimeline data={data.timeline} tasks={data.tasks} today={today}/>;
    if (data.tasks.length === 0) {
        return (<div ref={root}>
          {before}
          <OverviewHeader title={title} sub={sub}/>
          {lead}
          {timeline}
        </div>);
    }

    const whose = viewer === "pm" ? "your" : "their";
    const facts = throughputFacts(s.weekly.accepted, s.weekly.added);

    return (<div ref={root} className="relative scroll-mt-6">
      {before}
      <OverviewHeader title={title} sub={sub}/>
      {lead}

      {timeline}

      <div className="mt-4 grid items-stretch gap-4 lg:grid-cols-2">
        {/* Throughput, in plain words: new work against finished work, week by week. */}
        <OverviewCard id="throughput-heading" title="Finished vs new work" sub="Throughput · tasks in and tasks done each week, last 12 weeks" className="materialize flex flex-col" style={stagger(5)} aside={<button type="button" aria-pressed={table} onClick={() => setTable((v) => !v)} className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-[12.5px] font-medium text-ink-secondary hover:text-ink", focusRing)}>{table ? <><ChartColumn className="size-3.5" aria-hidden/>Chart</> : <><Table2 className="size-3.5" aria-hidden/>Table</>}</button>}>
          <ThroughputReadout f={facts} weeks={s.weeks} counts={s.weekly.accepted} viewer={viewer}/>
          {/* The table scrolls inside the chart's space, so switching views never changes the card's height. */}
          <div className="relative flex min-h-60 flex-1 flex-col justify-end px-5 pt-4 pb-5 sm:px-6">
            {table ? (<div tabIndex={0} aria-label="Weekly throughput table" className={cn("absolute inset-x-5 top-4 bottom-5 overflow-y-auto overscroll-contain rounded-xl shadow-[inset_0_0_0_1px_var(--line)] [scrollbar-width:thin] sm:inset-x-6", focusRing)}>
                <table className="w-full text-[13px] tabular">
                  <thead className="sticky top-0 z-10 bg-surface-subtle shadow-[inset_0_-1px_0_var(--line)]"><tr className="text-left text-ink-tertiary"><th className="px-3 py-2 font-medium">Week</th><th className="px-3 py-2 text-right font-medium">New</th><th className="px-3 py-2 text-right font-medium">Finished</th><th className="px-3 py-2 text-right font-medium">Open work</th></tr></thead>
                  <tbody>{s.weeks.map((w, i) => <tr key={w} className="border-t border-line first:border-t-0 hover:bg-surface-subtle"><td className="px-3 py-1.5">{weekRange(w)}</td><td className="px-3 py-1.5 text-right">{s.weekly.added[i]}</td><td className="px-3 py-1.5 text-right">{s.weekly.accepted[i]}</td><td className="px-3 py-1.5 text-right text-ink-secondary">{signed(s.weekly.added[i] - s.weekly.accepted[i])}</td></tr>)}</tbody>
                </table>
              </div>) : <WeekColumns accepted={s.weekly.accepted} added={s.weekly.added} weeks={s.weeks} average={facts.average}/>}
          </div>
        </OverviewCard>

        {/* Workload: a table, so the column names do the work a colour legend did. */}
        <OverviewCard id="workload-heading" title="Workload" sub="Open tasks per person, by where each one stands" className="materialize flex flex-col" style={stagger(6)}>
          <p className="px-5 pt-1 text-[13.5px] leading-relaxed text-pretty text-ink-secondary sm:px-6">{workloadSentence(workload, whose)}</p>
          {workload.rows.length === 0 ? <p className="px-5 pt-3 pb-6 text-sm text-ink-tertiary sm:px-6">No crew has open work.</p> : (<div className="px-2 pt-3 pb-3 sm:px-3">
              <table className="w-full text-[13px] tabular">
                <thead>
                  <tr className="text-right text-xs text-ink-tertiary">
                    <th className="px-3 py-2 text-left font-medium">Person</th>
                    <th className="px-2 py-2 font-medium max-sm:hidden">To do</th>
                    <th className="px-2 py-2 font-medium max-sm:hidden">In progress</th>
                    <th className="px-2 py-2 font-medium max-sm:hidden">In review</th>
                    <th className="px-2 py-2 font-medium">Late</th>
                    <th className="px-2 py-2 font-medium">Open</th>
                    <th className="px-3 py-2 font-medium">Days per task</th>
                  </tr>
                </thead>
                <tbody>
                  {workload.rows.map((r) => {
                    const [a, b, c] = r.open, open = a + b + c, slow = r.pace !== null && workload.team !== null && r.pace > workload.team + 0.5;
                    return (<tr key={r.person.id} className="border-t border-line text-right hover:bg-surface-subtle">
                      <td className="px-3 py-2.5 text-left">
                        <span className="flex min-w-0 items-center gap-2.5">
                          <Face person={asMember(r.person)} size={26}/>
                          <span className="min-w-0"><span className="block truncate font-semibold text-ink">{r.person.name}</span>
                            <span className="block text-[11.5px] text-ink-tertiary sm:hidden">{a} to do · {b} in progress · {c} in review</span>
                            {workload.worst === r.person.id ? <span className="block text-[11.5px] font-medium text-warning">Most work sent back</span> : null}
                          </span>
                        </span>
                      </td>
                      <td className="px-2 max-sm:hidden">{a}</td>
                      <td className="px-2 max-sm:hidden">{b}</td>
                      <td className="px-2 max-sm:hidden">{c}</td>
                      <td className={cn("px-2", r.late ? "font-semibold text-danger" : "text-ink-tertiary")}>{r.late}</td>
                      <td className="px-2 font-semibold text-ink">{open}</td>
                      <td className={cn("px-3", slow ? "font-semibold text-danger" : "text-ink-secondary")}>{r.pace === null ? "–" : `${r.pace} d`}</td>
                    </tr>);
                  })}
                </tbody>
              </table>
              <p className="px-3 pt-2.5 text-xs leading-snug text-ink-tertiary">Late counts open work past its due date. Days per task is how long accepted tasks took from start to acceptance{workload.team !== null ? `; the team's figure is ${workload.team} days, and red means slower than that` : ""}.</p>
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

const signed = (n: number) => (n > 0 ? `+${n}` : n < 0 ? `−${-n}` : "0");

/**
 * Throughput for someone who has never heard the word: a verdict first
 * (piling up, catching up, keeping pace), one sentence on why, one on the
 * recent pace, then three figures that back them.
 */
function ThroughputReadout({ f, weeks, counts, viewer }: { f: ThroughputFacts; weeks: string[]; counts: number[]; viewer: Viewer }) {
    if (f.trend === "none")
        return <p className="px-5 pt-1 text-[13.5px] leading-relaxed text-ink-secondary sm:px-6">No tasks were finished in the last 12 weeks{f.added ? `, while ${f.added} new ${f.added === 1 ? "one" : "ones"} came in` : ""}.</p>;
    const net = f.added - f.accepted;
    const you = viewer === "pm" ? "you" : "they";
    const verdict = net > 0
        ? { icon: AlertTriangle, tone: "bg-warning-soft text-warning", label: "Work is piling up", why: `${f.added} new tasks came in and ${f.accepted} were finished, so ${net} more are waiting than 12 weeks ago.` }
        : net < 0
            ? { icon: CheckCircle2, tone: "bg-success-soft text-success", label: "Catching up", why: `${f.accepted} tasks were finished and only ${f.added} new ones came in, so ${-net} fewer are waiting than 12 weeks ago.` }
            : { icon: Scale, tone: "bg-surface-sunken text-ink-secondary", label: "Keeping pace", why: `${f.accepted} tasks were finished and ${f.added} new ones came in, so open work is where it was 12 weeks ago.` };
    const pace = f.trend === "faster" ? `Lately ${you} are finishing more: ${f.recent.now} in the last 4 weeks, up from ${f.recent.before} in the 4 weeks before.`
        : f.trend === "slower" ? `Lately ${you} are finishing less: ${f.recent.now} in the last 4 weeks, down from ${f.recent.before} in the 4 weeks before.`
            : `Lately the pace is the same: ${f.recent.now} finished in the last 4 weeks and in the 4 weeks before.`;
    const Icon = verdict.icon;
    const cell = "grid gap-0.5 rounded-xl bg-surface-subtle px-3 py-2.5";
    return (<div className="grid gap-3 px-5 pt-1 sm:px-6">
      <div className="grid gap-1.5">
        <span className={cn("inline-flex w-fit items-center gap-1.5 rounded-full px-2.5 py-1 text-[13px] font-semibold", verdict.tone)}><Icon className="size-4" aria-hidden/>{verdict.label}</span>
        <p className="text-[13.5px] leading-relaxed text-pretty text-ink-secondary">{verdict.why} {pace}</p>
      </div>
      <dl className="grid grid-cols-3 gap-2 text-[12px]">
        <div className={cell}><dt className="text-ink-tertiary">A usual week</dt><dd className="text-[17px] leading-tight font-semibold text-ink tabular">{f.average}<span className="text-[12px] font-medium text-ink-tertiary"> finished</span></dd></div>
        <div className={cell}><dt className="text-ink-tertiary">Last 4 weeks</dt><dd className="flex flex-wrap items-center gap-x-1 text-[17px] leading-tight font-semibold text-ink tabular">{f.recent.now}
          <span className={cn("inline-flex items-center gap-0.5 text-[12px] font-medium", f.trend === "faster" ? "text-success" : f.trend === "slower" ? "text-warning" : "text-ink-tertiary")}>
            {f.trend === "faster" ? <TrendingUp className="size-3.5" aria-hidden/> : f.trend === "slower" ? <TrendingDown className="size-3.5" aria-hidden/> : <Minus className="size-3.5" aria-hidden/>}
            {f.trend === "steady" ? "same as before" : `${f.trend === "faster" ? "up" : "down"} from ${f.recent.before}`}
          </span></dd></div>
        <div className={cell}><dt className="text-ink-tertiary">Best week</dt><dd className="leading-tight font-semibold text-ink tabular">{f.busiest === null ? "–" : <>{weekRange(weeks[f.busiest])}<span className="block text-[12px] font-medium text-ink-tertiary">{plural(counts[f.busiest], "task")} finished</span></>}</dd></div>
      </dl>
    </div>);
}

/** The workload table in one sentence. */
function workloadSentence(w: { rows: unknown[]; total: { open: number; late: number; review: number } }, whose: string): string {
    if (w.rows.length === 0)
        return "Nobody has open work right now.";
    const people = w.rows.length === 1 ? "1 person" : `${w.rows.length} people`;
    const late = w.total.late ? `${w.total.late} ${w.total.late === 1 ? "is" : "are"} late` : "none are late";
    return `${w.total.open} open ${w.total.open === 1 ? "task" : "tasks"} across ${people}: ${late}, and ${w.total.review} ${w.total.review === 1 ? "is" : "are"} waiting for ${whose} review.`;
}
