"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, CalendarDays, ChartLine, ChevronDown, Layers, Table2, Undo2 } from "lucide-react";
import { AreaChart, weekRange } from "@/components/analytics/flow-charts";
import { asMember } from "@/components/analytics/marks";
import { Face, focusRing, OverviewCard, OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { openLoad, type Person, type TaskMove } from "@/lib/analytics";
import { projectBoardPath, projectReviewPath } from "@/lib/constants";
import { addDays, daysBetween, formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { daysPerTask, flowSummary, openNow, readiness, scopeFlow, type FlowPhase, type FlowTask, type Later, type OpenTask, type Stat, type StepStat } from "@/lib/flow";
import { cn } from "@/lib/utils";

export type FlowData = {
    tasks: FlowTask[];
    moves: TaskMove[];
    phases: FlowPhase[];
    projects: { id: string; title: string; active: boolean }[];
    crew: Person[];
};
type Viewer = "pm" | "owner";
/** Whole weeks, so the weekly charts add up to the tiles. */
type Period = 4 | 12;

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const OTHER = "var(--series-other)";
const r1 = (n: number) => Math.round(n * 10) / 10;
/** An unknown wait (entered before moves were logged) reads as fresh: never flagged on a guess. */
const age = (d: number | null) => (d === null ? "fresh" : d >= 7 ? "stale" : d >= 3 ? "aging" : "fresh");
/** Below this many tasks a typical value is shown muted and called too few to tell. */
const FEW = 3;
/** A change against the period before shows only when both periods rest on at least this many tasks; fewer is noise. */
const COMPARABLE = 5;
const comparable = (now: Stat, before: Stat) => now.tasks >= COMPARABLE && before.tasks >= COMPARABLE;
const AGE_BG = { fresh: "bg-[var(--age-fresh)]", aging: "bg-stage-review", stale: "bg-stage-late" } as const;
const pill = "inline-flex h-[22px] items-center gap-0.5 rounded-full px-2 text-xs font-semibold whitespace-nowrap tabular [&_svg]:size-3";
const daysText = (d: number) => (d === 0 ? "Today" : plural(d, "day"));
/** A hollow ring: a task that can't start yet. Shape, not just colour, sets it apart from the age dots. */
const RING = "size-[9px] shrink-0 rounded-full border-[1.5px] border-[var(--age-fresh)]";
/** The dashed stretch before a task was ready: not counted as waiting. */
const DASH = { backgroundImage: "repeating-linear-gradient(90deg, var(--age-fresh) 0 4px, transparent 4px 8px)" };
const shortDay = (instant: string) => formatDate(isoDateIn(instant), { month: "short", day: "numeric" });
const laterText = (l: Later) => (l.phase ? `After ${l.phase.title}` : `Starts ${formatDate(l.date!, { month: "short", day: "numeric" })}`);

/**
 * The Analytics page's Flow: how work moves through a manager's projects.
 * The task journey (each flow number once, with its change and what sits in
 * each step now), then throughput (added against accepted) and workload. One period and one filter (a project or a person) drive it all;
 * every count is worked out here from the raw rows.
 */
export function FlowView({ data, viewer, firstName, today, title, sub, before }: {
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
    const [period, setPeriod] = React.useState<Period>(12);
    const [filter, setFilter] = React.useState("all");
    const [step, setStep] = React.useState(2);
    const [showAll, setShowAll] = React.useState(false);
    const [table, setTable] = React.useState(false);
    /** To do's list: the tasks ready now, or the ones that can't start yet. */
    const [later, setLater] = React.useState(false);
    const root = React.useRef<HTMLDivElement>(null);

    const you = viewer === "pm" ? "you" : firstName;
    const your = viewer === "pm" ? "Your" : `${firstName}’s`;
    const projectOf = React.useMemo(() => new Map(data.projects.map((p, i) => [p.id, { ...p, color: SERIES[i] ?? OTHER }])), [data.projects]);
    const personOf = React.useMemo(() => new Map(data.crew.map((p, i) => [p.id, { ...p, color: SERIES[i] ?? OTHER }])), [data.crew]);

    const scope: { kind: "project" | "person"; id: string } | null = filter.startsWith("p:") ? { kind: "project", id: filter.slice(2) } : filter.startsWith("u:") ? { kind: "person", id: filter.slice(2) } : null;
    const scoped = React.useMemo(() => {
        if (filter === "all") return { tasks: data.tasks, moves: data.moves };
        const id = filter.slice(2), byProject = filter.startsWith("p:");
        return scopeFlow(data.tasks, data.moves, (t) => (byProject ? t.project_id === id : t.assigned_to === id));
    }, [data, filter]);
    // From every task: a phase opens only when all of its tasks are accepted, whoever they belong to.
    const ready = React.useMemo(() => readiness(data.tasks, data.phases, today), [data.tasks, data.phases, today]);
    const s = React.useMemo(() => flowSummary(scoped.tasks, scoped.moves, today, period, ready), [scoped, today, period, ready]);
    const from = addDays(today, 1 - period * 7);
    const scopeName = !scope ? null : scope.kind === "project" ? projectOf.get(scope.id)?.title : personOf.get(scope.id)?.name;
    const pick = (f: string) => {
        setFilter((cur) => (cur === f ? "all" : f));
        setShowAll(false);
        root.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };

    // Numbers for the tiles.
    const journey = s.now.journey, journeyBefore = s.before.journey;
    const rate = (x: number, y: number) => (y ? (x / y) * 100 : null);

    // Workload: everyone's open work (inside the chosen project, when there is one).
    const base = scope?.kind === "project" ? scoped : data;
    const workload = React.useMemo(() => {
        const team = daysPerTask(base.tasks, base.moves, today, period * 7);
        const rows = data.crew.map((p) => {
            const mine = scopeFlow(base.tasks, base.moves, (t) => t.assigned_to === p.id);
            const open = openNow(mine.tasks, mine.moves, today).map((l) => l.length);
            const inPeriod = mine.moves.filter((m) => isoDateIn(m.at) >= from);
            const submitted = inPeriod.filter((m) => m.to === "review").length, back = inPeriod.filter((m) => m.from === "review" && m.to === "in_progress").length;
            return { person: p, open, late: openLoad(mine.tasks, today).late, pace: daysPerTask(mine.tasks, mine.moves, today, period * 7), submitted, back };
        }).filter((r) => r.open.some(Boolean) || r.submitted > 0);
        const maxOpen = Math.max(1, ...rows.map((r) => r.open[0] + r.open[1] + r.open[2]));
        const worst = rows.filter((r) => r.submitted >= 3 && r.back / r.submitted > 0.12).sort((a, b) => b.back / b.submitted - a.back / a.submitted)[0]?.person.id;
        return { team, rows, maxOpen, worst };
    }, [base, data.crew, today, period, from]);

    if (data.tasks.length === 0) {
        return (<div ref={root}>
          {before}
          <OverviewHeader title={title} sub={sub}/>
          <OverviewCard id="flow-empty" title="Task journey" className="materialize mt-7" style={stagger(1)}>
            <p className="px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6">No tasks yet. This page fills in as the crew moves tasks from To do to Accepted.</p>
          </OverviewCard>
        </div>);
    }

    const STEP_NAMES = ["Waiting to start", "Being worked on", `Waiting for ${you}`];
    const TAGS = ["To do", "In progress", "In review"];
    // Only call a step slowest when both have enough tasks to say so.
    const [d0, d1] = s.now.steps;
    const slowest = d0.tasks >= FEW && d1.tasks >= FEW && Math.max(d0.days!, d1.days!) > 0 ? (d1.days! >= d0.days! ? 1 : 0) : -1;
    // A floor so 0-day steps still get a share of the row (all zeros = equal thirds) and the loop maths never divides by 0.
    const grow = s.now.steps.map((d) => Math.max(d.days ?? 1, 0.5)), sum = grow.reduce((a, b) => a + b, 0);
    const mid1 = ((grow[0] + grow[1] / 2) / sum) * 100, mid2 = ((grow[0] + grow[1] + grow[2] / 2) / sum) * 100;
    const waiting = s.open[0].filter((o) => !o.later), planned = s.open[0].filter((o) => o.later);
    const lists = [waiting, s.open[1], s.open[2]];
    const list = step === 0 && later && planned.length ? planned : lists[step], shown = showAll ? list : list.slice(0, 5);
    // One scale for every wait bar in To do: the oldest task's age.
    const span = Math.max(7, ...waiting.map((o) => daysBetween(isoDateIn(o.task.created_at), isoDateIn(o.since!)) + o.days!));
    const net = s.now.added - s.now.accepted;

    return (<div ref={root} className="relative scroll-mt-6">
      {before}
      <OverviewHeader title={title} sub={sub} actions={<div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Period" className="inline-flex rounded-xl bg-surface p-[3px] shadow-[0_0_0_1px_var(--line)]">
            {([4, 12] as const).map((d) => <button key={d} type="button" aria-label={`Last ${d} weeks`} aria-pressed={period === d} onClick={() => setPeriod(d)} className={cn("h-8 min-w-13 rounded-[9px] px-3 text-[13px] font-semibold transition-colors", period === d ? "bg-ink text-surface" : "text-ink-tertiary hover:text-ink", focusRing)}>{d}W</button>)}
          </div>
          <label className={cn("relative inline-flex h-[38px] items-center rounded-xl bg-surface pl-3 shadow-[0_0_0_1px_var(--line)] focus-within:shadow-[0_0_0_2px_var(--copper)]", filter !== "all" && "shadow-[0_0_0_1.5px_var(--copper),0_0_0_5px_var(--copper-soft)]")}>
            <span className="text-[13px] text-ink-tertiary">Show</span>
            <select value={filter} onChange={(e) => { setFilter(e.target.value); setShowAll(false); }} className="h-full max-w-52 cursor-pointer appearance-none bg-transparent pr-8 pl-2 text-[13.5px] font-semibold text-ink outline-none">
              <option value="all">All work</option>
              <optgroup label="Projects">{data.projects.map((p) => <option key={p.id} value={`p:${p.id}`}>{p.title}{p.active ? "" : " (delivered)"}</option>)}</optgroup>
              {data.crew.length ? <optgroup label="Crew">{data.crew.map((p) => <option key={p.id} value={`u:${p.id}`}>{p.name}</option>)}</optgroup> : null}
            </select>
            <ChevronDown className="pointer-events-none absolute right-3 size-3.5 text-ink-tertiary" aria-hidden/>
          </label>
          {filter !== "all" ? <button type="button" onClick={() => setFilter("all")} className={cn("h-[38px] rounded-xl px-2.5 text-[13px] font-semibold text-brand hover:bg-brand-soft", focusRing)}>Clear</button> : null}
        </div>}/>

      {/* Task journey: the page's one place for the flow numbers and their change against the period before. */}
      <OverviewCard id="journey-heading" title={scopeName ? `Task journey · ${scopeName}` : "Task journey"} sub="Typical days at each step, tasks still there included · each dot is a task there now" className="materialize mt-6" style={stagger(1)} aside={<AgeKey later={planned.length > 0}/>}>
        <div className="px-5 pb-5 sm:px-6">
          <div className="mt-3 mb-2.5 grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px]">
            <div className="flex items-center gap-2.5">
              <span className="h-2 flex-1 translate-y-1 rounded-t border-[1.5px] border-b-0 border-line-strong max-lg:hidden" aria-hidden/>
              <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold whitespace-nowrap">
                {journey.tasks === 0 ? "Nothing accepted yet" : journey.tasks < FEW
                    ? <span className="font-medium text-ink-tertiary">Only {plural(journey.tasks, "task")} accepted, too few to tell</span>
                    : <>{journey.days} days from ready to accepted<span className="font-normal text-ink-tertiary">· typical of {journey.tasks}</span></>}
                {comparable(journey, journeyBefore) ? <Delta now={journey.days} before={journeyBefore.days} unit=" d"/> : null}
              </span>
              <span className="h-2 flex-1 translate-y-1 rounded-t border-[1.5px] border-b-0 border-line-strong max-lg:hidden" aria-hidden/>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px]">
            <div className="flex flex-col gap-2 lg:flex-row">
              {[0, 1, 2].map((i) => <StepBox key={i} i={i} name={STEP_NAMES[i]} tag={TAGS[i]} stat={s.now.steps[i]} before={s.before.steps[i]} open={lists[i]} later={i === 0 ? planned : []} grow={grow[i]} pressed={step === i} flag={i === 2 ? `${your} step` : i === slowest ? "Slowest" : null} projectOf={projectOf} personOf={personOf} onClick={() => { setStep(i); setShowAll(false); setLater(false); }}/>)}
            </div>
            <div className="flex flex-col gap-2.5 rounded-2xl bg-success-soft p-3.5">
              <span className="text-[13.5px] font-semibold">Accepted<span className="block text-xs font-normal text-ink-tertiary">Done</span></span>
              <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
                <b className="text-[32px] leading-none font-semibold tracking-[-0.035em] text-success tabular">{s.now.accepted}<small className="ml-1 text-[13.5px] font-medium tracking-normal text-ink-tertiary">tasks</small></b>
                <Delta now={s.now.accepted} before={s.before.accepted} worseWhenUp={false} whole/>
              </span>
              <span className="mt-auto flex flex-col items-start gap-1.5 border-t border-success/20 pt-2.5 text-[12.5px] text-ink-secondary">
                {s.now.dated ? <span><b className="font-semibold text-ink tabular">{s.now.onTime} of {s.now.dated}</b> by due date</span> : "None had a due date"}
                <Delta now={rate(s.now.onTime, s.now.dated)} before={rate(s.before.onTime, s.before.dated)} worseWhenUp={false} unit=" pts" whole/>
              </span>
            </div>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_150px] lg:gap-2">
            <div className="relative py-3 lg:h-14 lg:py-0">
              {s.now.submitted ? <span className="absolute top-1.5 h-6 rounded-b-[14px] border-[1.5px] border-t-0 border-dashed border-copper transition-[left,width] duration-500 before:absolute before:-top-0.75 before:-left-1.5 before:border-x-[5px] before:border-b-[7px] before:border-x-transparent before:border-b-copper before:content-[''] max-lg:hidden" style={{ left: `${mid1}%`, width: `${mid2 - mid1}%` }} aria-hidden/> : null}
              <span className="inline-flex flex-wrap items-center gap-1.5 lg:absolute lg:top-7 lg:-translate-x-1/2 lg:flex-nowrap lg:whitespace-nowrap" style={{ left: `${(mid1 + mid2) / 2}%` }}>
                <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-semibold text-brand">
                  <Undo2 className="size-3.5" aria-hidden/>
                  {s.now.submitted ? <>{s.now.sentBack} of {plural(s.now.submitted, "submission")} sent back{s.reworkDays !== null ? ` · typically +${s.reworkDays} d` : ""}</> : "Nothing submitted for review yet"}
                </span>
                {s.now.submitted ? <Delta now={rate(s.now.sentBack, s.now.submitted)} before={rate(s.before.sentBack, s.before.submitted)} unit=" pts" whole/> : null}
              </span>
            </div>
          </div>
          <div id="flow-step-tasks" className="rounded-2xl bg-surface-subtle shadow-[0_0_0_1px_var(--line)]" aria-live="polite">
            <div className="flex flex-wrap items-center justify-between gap-2 px-4 pt-3 pb-2">
              <h3 className="text-sm font-semibold">{STEP_NAMES[step]}</h3>
              {step === 0 && planned.length ? (<div role="group" aria-label="Which tasks" className="inline-flex gap-0.5 rounded-[10px] bg-surface-sunken p-[3px]">
                  {[false, true].map((l) => {
                        const on = later === l;
                        return (<button key={String(l)} type="button" aria-pressed={on} onClick={() => { setLater(l); setShowAll(false); }} className={cn("inline-flex h-7 items-center gap-1.5 rounded-lg px-2.5 text-[12.5px] font-semibold transition-[background-color,color,box-shadow] duration-150", on ? "bg-surface text-ink shadow-[0_1px_2px_rgb(14_18_34/0.08),0_0_0_1px_rgb(14_18_34/0.06)]" : "text-ink-secondary hover:text-ink", focusRing)}>
                          {l ? <><span className={RING} aria-hidden/>Later</> : "Ready"}
                          <span className={cn("min-w-[18px] rounded-full px-1.5 text-center text-[11px] leading-[17px] tabular", on ? "bg-ink text-surface" : "bg-line text-ink-secondary")}>{l ? planned.length : waiting.length}</span>
                        </button>);
                    })}
                </div>) : <span className="text-[13px] text-ink-tertiary">{plural(list.length, "task")} · longest wait first</span>}
            </div>
            {list.length === 0 ? <p className="border-t border-line px-4 py-3.5 text-sm text-ink-tertiary">{step === 0 && planned.length ? "Nothing is ready to start. Everything here is waiting on an earlier phase or its start date." : "Nothing here right now."}</p> : shown.map((o) => <TaskRow key={o.task.id} o={o} viewer={viewer} projectOf={projectOf} personOf={personOf} span={step === 0 ? span : undefined}/>)}
            {list.length > 5 ? <button type="button" onClick={() => setShowAll((v) => !v)} className={cn("block w-full rounded-b-2xl border-t border-line px-4 py-2.5 text-left text-[13px] font-semibold text-brand hover:bg-brand-soft", focusRing)}>{showAll ? "Show fewer" : `Show all ${list.length}`}</button> : null}
          </div>
        </div>
      </OverviewCard>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* Throughput */}
        <OverviewCard id="throughput-heading" title="Throughput" sub="Tasks added and accepted each week" className="materialize" style={stagger(2)} aside={<div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-ink-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-copper" aria-hidden/>Accepted</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-[color:var(--series-2)]" aria-hidden/>Added</span>
            <button type="button" aria-pressed={table} onClick={() => setTable((v) => !v)} className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-full bg-surface-sunken px-3 font-medium hover:text-ink", focusRing)}>{table ? <><ChartLine className="size-3.5" aria-hidden/>Chart</> : <><Table2 className="size-3.5" aria-hidden/>Table</>}</button>
          </div>}>
          <p className="px-5 pt-1 text-[13.5px] text-ink-secondary sm:px-6">
            <b className="font-semibold text-ink tabular">{s.now.added}</b> added · {net === 0 ? "open work unchanged" : <>open work {net > 0 ? "up" : "down"} <b className="font-semibold text-ink tabular">{Math.abs(net)}</b></>}
          </p>
          <div className="px-4 pt-4 pb-5 sm:px-5">
            {table ? (<table className="w-full text-[13px] tabular">
                <thead><tr className="text-left text-ink-tertiary"><th className="px-2.5 py-1.5 font-medium">Week</th><th className="px-2.5 py-1.5 text-right font-medium">Added</th><th className="px-2.5 py-1.5 text-right font-medium">Accepted</th></tr></thead>
                <tbody>{s.weeks.map((w, i) => <tr key={w} className="border-t border-line"><td className="px-2.5 py-1.5">{weekRange(w)}</td><td className="px-2.5 py-1.5 text-right">{s.weekly.added[i]}</td><td className="px-2.5 py-1.5 text-right">{s.weekly.accepted[i]}</td></tr>)}</tbody>
              </table>) : <AreaChart accepted={s.weekly.accepted} added={s.weekly.added} weeks={s.weeks}/>}
          </div>
        </OverviewCard>

        {/* Workload */}
        <OverviewCard id="workload-heading" title="Workload" sub={workload.team === null ? "Open tasks per person" : `Open tasks per person · days per task against the team’s ${workload.team}`} className="materialize" style={stagger(3)} aside={<span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-todo" aria-hidden/>To do</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-progress" aria-hidden/>In progress</span>
            <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-review" aria-hidden/>In review</span>
          </span>}>
          {workload.rows.length === 0 ? <p className="px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6">No crew has open work here.</p> : (<div className="grid gap-0.5 px-3 pt-2 pb-3.5">
              {workload.rows.map((r) => {
                    const f = `u:${r.person.id}`, [a, b, c] = r.open, slow = r.pace !== null && workload.team !== null && r.pace > workload.team + 0.5;
                    return (<button key={r.person.id} type="button" aria-pressed={filter === f} onClick={() => pick(f)} className={cn("grid grid-cols-[minmax(0,1fr)_76px] items-center gap-x-3.5 gap-y-2 rounded-xl px-2.5 py-2 text-left transition-colors hover:bg-surface-subtle aria-pressed:bg-brand-soft sm:grid-cols-[minmax(0,150px)_minmax(0,1fr)_76px]", focusRing)}>
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
                    </button>);
                })}
            </div>)}
        </OverviewCard>
      </div>
      <Tooltip root={root}/>
    </div>);
}

/** A change against the period before. Hidden when there is nothing to compare. */
function Delta({ now, before, worseWhenUp = true, unit = "", whole = false }: { now: number | null; before: number | null; worseWhenUp?: boolean; unit?: string; whole?: boolean }) {
    if (now === null || before === null) return null;
    const d = whole ? Math.round(now - before) : r1(now - before);
    if (Math.abs(d) < (whole ? 1 : 0.15)) return <span className={cn(pill, "bg-surface-sunken text-ink-tertiary")}>Same as before</span>;
    const worse = d > 0 === worseWhenUp;
    return (<span className={cn(pill, worse ? "bg-danger-soft text-danger" : "bg-success-soft text-success")}>
      {d > 0 ? <ArrowUp aria-hidden/> : <ArrowDown aria-hidden/>}{Math.abs(d)}{unit}
      <span className="sr-only">, {worse ? "worse" : "better"} than the period before</span>
    </span>);
}

function AgeKey({ later }: { later: boolean }) {
    return (<span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-secondary">
      <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", AGE_BG.fresh)} aria-hidden/>Under 3 days</span>
      <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", AGE_BG.aging)} aria-hidden/>3 to 6 days</span>
      <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", AGE_BG.stale)} aria-hidden/>A week or more</span>
      {later ? <span className="inline-flex items-center gap-1.5"><span className={cn(RING, "size-2.5")} aria-hidden/>Not ready yet</span> : null}
    </span>);
}

type ProjectMap = Map<string, { id: string; title: string; active: boolean; color: string }>;
type PersonMap = Map<string, Person & { color: string }>;

/**
 * One step of the journey: typical days and what they rest on (how many
 * tasks, how many still there), its change when both periods have enough
 * tasks, a dot per task there now (a ring per To do task that can't start
 * yet). Pressing it lists those tasks below.
 */
function StepBox({ i, name, tag, stat, before, open, later, grow, pressed, flag, projectOf, personOf, onClick }: {
    i: number; name: string; tag: string; stat: StepStat; before: StepStat; open: OpenTask[]; later: OpenTask[]; grow: number; pressed: boolean; flag: string | null;
    projectOf: ProjectMap; personOf: PersonMap; onClick: () => void;
}) {
    const few = stat.tasks > 0 && stat.tasks < FEW;
    const basis = stat.tasks === 0 ? "No tasks yet" : few ? `Only ${plural(stat.tasks, "task")}, too few to tell`
        : `Typical of ${stat.tasks}${stat.open ? ` · ${stat.open} still ${["waiting", "going", "waiting"][i]}` : ""}`;
    const mine = i === 2, stale = open.filter((o) => (o.days ?? 0) >= 7).length, unassigned = i === 0 ? open.filter((o) => !o.task.assigned_to).length : 0;
    return (<button type="button" aria-pressed={pressed} aria-controls="flow-step-tasks" onClick={onClick} style={{ flexGrow: grow }} className={cn(
            "flex min-w-0 basis-0 flex-col gap-2.5 rounded-2xl px-4 pt-3.5 pb-3 text-left transition-[flex-grow,box-shadow,translate,background-color] duration-500 ease-[var(--ease-spring)] hover:-translate-y-px lg:min-w-40",
            mine ? "bg-brand-soft shadow-[0_0_0_1.5px_rgb(217_119_6/0.45)]" : "bg-surface-subtle shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong),0_14px_28px_-18px_rgb(14_18_34/0.3)]",
            pressed && (mine ? "shadow-[0_0_0_2px_var(--copper)]" : "shadow-[0_0_0_2px_var(--ink)]"),
            focusRing)}>
      <span className="flex items-start justify-between gap-2">
        <span><span className="block text-[13.5px] font-semibold text-ink">{name}</span><span className="block text-xs text-ink-tertiary">{tag}</span></span>
        {flag ? <span className={cn("rounded-full px-2 text-[11.5px] leading-[22px] font-semibold whitespace-nowrap", mine ? "bg-brand text-white" : "bg-ink text-surface")}>{flag}</span> : null}
      </span>
      <span className="flex flex-col gap-1.5">
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
          <b className={cn("text-[32px] leading-none font-semibold tracking-[-0.035em] tabular transition-colors", few ? "text-ink-tertiary" : "text-ink")}>{stat.days ?? "–"}{stat.days !== null ? <small className="ml-1 text-[13.5px] font-medium tracking-normal text-ink-tertiary">days</small> : null}</b>
          {comparable(stat, before) ? <Delta now={stat.days} before={before.days} unit=" d"/> : null}
        </span>
        <span className="text-xs text-ink-tertiary tabular">{basis}</span>
      </span>
      <span className="flex min-h-[22px] flex-wrap content-start gap-1" aria-hidden>
        {open.length + later.length === 0 ? <span className="text-[12.5px] text-ink-tertiary">Empty</span> : open.map((o) => {
                const p = projectOf.get(o.task.project_id), who = o.task.assigned_to ? personOf.get(o.task.assigned_to)?.name : null;
                const wait = o.days === null ? "Moved here before tracking began" : i === 0 ? (o.days === 0 ? "Ready today" : `Ready since ${shortDay(o.since!)} · ${plural(o.days, "day")} waiting`) : o.days === 0 ? "Arrived today" : `${plural(o.days, "day")} in this step`;
                return <i key={o.task.id} className={cn("size-[9px] rounded-[3px] transition-transform hover:scale-150", AGE_BG[age(o.days)])} data-tip={`${o.task.title}\n${p?.title ?? ""} · ${who ?? "Unassigned"}\n${wait}`}/>;
            })}
        {later.length ? <>
            {open.length ? <span className="mx-1 h-[9px] w-px self-center bg-line-strong"/> : null}
            {later.map((o) => {
                const p = projectOf.get(o.task.project_id), who = o.task.assigned_to ? personOf.get(o.task.assigned_to)?.name : null;
                return <i key={o.task.id} className={cn(RING, "transition-transform hover:scale-150")} data-tip={`${o.task.title}\n${p?.title ?? ""} · ${who ?? "Unassigned"}\nNot ready yet · ${laterText(o.later!)}`}/>;
            })}
          </> : null}
      </span>
      <span className={cn("mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-[12.5px] text-ink-secondary", mine ? "border-copper/20" : "border-line")}>
        <span><b className="font-semibold text-ink tabular">{open.length}</b> {mine ? "waiting" : i === 0 ? "ready" : "here"}{stale ? <span className="text-danger"> · {stale} over a week</span> : null}{unassigned ? <> · <b className="font-semibold text-ink tabular">{unassigned}</b> unassigned</> : null}{later.length ? <span className="text-ink-tertiary"> · <b className="font-semibold tabular">{later.length}</b> later</span> : null}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-300", pressed ? "rotate-180 text-ink" : "text-ink-tertiary")} aria-hidden/>
      </span>
    </button>);
}

/** One open task. In To do (`span` set) its wait shows as a bar on that shared scale, or what it still waits on when it can't start yet. */
function TaskRow({ o, viewer, projectOf, personOf, span }: { o: OpenTask; viewer: Viewer; projectOf: ProjectMap; personOf: PersonMap; span?: number }) {
    const p = projectOf.get(o.task.project_id), who = o.task.assigned_to ? personOf.get(o.task.assigned_to) : null, a = age(o.days);
    const days = o.days === null
        ? <span className="shrink-0 text-[13px] text-ink-tertiary" data-tip={"Not tracked\nMoved here before tracking began, so its time here is unknown"}>Not tracked</span>
        : <span className={cn("inline-flex shrink-0 items-center gap-1.5 font-semibold tabular", a === "stale" && "text-danger")}><span className={cn("size-2 rounded-[2.5px]", AGE_BG[a])} aria-hidden/>{daysText(o.days)}</span>;
    return (<div className={cn("grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t border-line px-4 py-2.5 text-[13.5px] transition-colors hover:bg-surface/70", span ? "sm:grid-cols-[minmax(0,1fr)_170px_minmax(150px,260px)_auto]" : "sm:grid-cols-[minmax(0,1fr)_170px_84px_auto]")}>
      <span className="min-w-0"><span className={cn("block truncate", o.later ? "font-medium" : "font-semibold")}>{o.task.title}</span><span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-tertiary"><span className="size-2 shrink-0 rounded-full" style={{ background: p?.color ?? OTHER }} aria-hidden/><span className="truncate">{p?.title}</span></span></span>
      <span className="flex min-w-0 items-center gap-2 text-[13px] max-sm:hidden">{who ? <><Face person={asMember(who)} size={22}/><span className="truncate">{who.name}</span></> : <span className="text-ink-tertiary">Unassigned</span>}</span>
      {o.later ? (<span className="flex min-w-0 items-center gap-3">
          <span className="relative h-6 w-20 shrink-0 max-sm:hidden" aria-hidden><span className="absolute top-[11px] right-1.5 left-0 h-0.5" style={DASH}/><span className="absolute top-[7px] right-0 size-2.5 rounded-full border-2 border-[var(--age-fresh)] bg-surface"/></span>
          <span className="inline-flex min-w-0 items-center gap-1.5 text-[13px] font-semibold text-ink-secondary [&_svg]:size-3.5 [&_svg]:shrink-0">{o.later.phase ? <Layers aria-hidden/> : <CalendarDays aria-hidden/>}<span className="truncate">{laterText(o.later)}</span></span>
        </span>) : span ? <span className="flex min-w-0 items-center justify-end gap-3"><WaitBar o={o} span={span}/>{days}</span> : days}
      {viewer === "pm" ? (o.step === 2
            ? <Link href={`${projectReviewPath(o.task.project_id)}?task=${o.task.id}`} className={cn("justify-self-end rounded-full bg-brand px-3 text-[12.5px] leading-7 font-semibold text-white hover:bg-brand-hover max-sm:col-span-2 max-sm:justify-self-start", focusRing)}>Review</Link>
            : <Link href={`${projectBoardPath(o.task.project_id)}?task=${o.task.id}`} className={cn("justify-self-end rounded-full bg-surface-sunken px-3 text-[12.5px] leading-7 font-semibold text-ink hover:bg-line max-sm:col-span-2 max-sm:justify-self-start", focusRing)}>Open</Link>)
        : <span className="max-sm:hidden"/>}
    </div>);
}

/**
 * A To do task's wait on the list's shared scale: dashed from creation to the
 * day it could start (not counted), a pin on that day, then a solid bar to
 * today in its age colour. Hover or focus shows the dates.
 */
function WaitBar({ o, span }: { o: OpenTask; span: number }) {
    // To do always knows when its wait began.
    const since = o.since!, wait = o.days!;
    const pre = Math.max(0, daysBetween(isoDateIn(o.task.created_at), isoDateIn(since)));
    const x = (d: number) => `${Math.max(0, 100 - (d / span) * 100)}%`;
    const a = age(wait), created = shortDay(o.task.created_at), readyOn = shortDay(since);
    return (<span tabIndex={0} role="img" aria-label={`Created ${created}. Ready ${readyOn}, ${o.why}. Waiting ${daysText(wait)}.`} className={cn("group/bar relative block h-6 min-w-0 flex-1 rounded max-sm:hidden", focusRing)}>
      <span className="absolute top-1 right-0 h-4 w-px bg-line-strong" aria-hidden/>
      {pre ? <span className="absolute top-[11px] h-0.5" style={{ ...DASH, left: x(pre + wait), width: `${(Math.min(pre, span) / span) * 100}%` }} aria-hidden/> : null}
      <span className={cn("absolute top-2 right-0 h-2 rounded-full", AGE_BG[a])} style={{ left: x(wait) }} aria-hidden/>
      <span className="absolute top-[7px] -ml-[5px] size-2.5 rounded-full bg-surface shadow-[0_0_0_2px_var(--ink)]" style={{ left: x(wait) }} aria-hidden/>
      <span className="pointer-events-none absolute right-0 bottom-[calc(100%+8px)] z-20 grid w-max min-w-56 translate-y-1 grid-cols-[16px_auto_1fr] items-center gap-x-2.5 gap-y-1.5 rounded-[10px] bg-rail px-3 py-2.5 text-xs text-rail-ink opacity-0 shadow-[0_12px_28px_-8px_rgb(11_14_26/0.5)] transition-[opacity,translate] duration-150 group-hover/bar:translate-y-0 group-hover/bar:opacity-100 group-focus-visible/bar:translate-y-0 group-focus-visible/bar:opacity-100" aria-hidden>
        <i className="h-0.5" style={DASH}/><span className="text-rail-ink-tertiary">Created</span><b className="font-semibold">{created}</b>
        <i className="size-2 justify-self-center rounded-full bg-rail-ink"/><span className="text-rail-ink-tertiary">Ready</span><b className="font-semibold">{readyOn}<span className="font-normal text-rail-ink-secondary"> · {o.why}</span></b>
        <i className={cn("h-1.5 rounded-full", AGE_BG[a])}/><span className="text-rail-ink-tertiary">Waiting</span><b className="font-semibold">{daysText(wait)}</b>
      </span>
    </span>);
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
