"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowDown, ArrowUp, ChartLine, ChevronDown, Table2, Undo2 } from "lucide-react";
import { AreaChart, Donut, Spark, WeekBars, type Slice } from "@/components/analytics/flow-charts";
import { asMember } from "@/components/analytics/marks";
import { Face, focusRing, OverviewCard, OverviewHeader, stagger } from "@/components/dashboard/overview-kit";
import { openLoad, type Person, type TaskMove } from "@/lib/analytics";
import { projectBoardPath, projectReviewPath } from "@/lib/constants";
import { addDays, formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { acceptedIn, daysPerTask, flowSummary, journeyDays, openNow, scopeFlow, type FlowTask, type OpenTask } from "@/lib/flow";
import { cn } from "@/lib/utils";

export type FlowData = {
    tasks: FlowTask[];
    moves: TaskMove[];
    projects: { id: string; title: string; active: boolean }[];
    crew: Person[];
};
type Viewer = "pm" | "owner";
type Period = 30 | 90;

const SERIES = ["var(--series-1)", "var(--series-2)", "var(--series-3)", "var(--series-4)"];
const OTHER = "var(--series-other)";
const r1 = (n: number) => Math.round(n * 10) / 10;
const age = (d: number) => (d >= 7 ? "stale" : d >= 3 ? "aging" : "fresh");
const AGE_BG = { fresh: "bg-[var(--age-fresh)]", aging: "bg-stage-review", stale: "bg-stage-late" } as const;
const pill = "inline-flex h-[22px] items-center gap-0.5 rounded-full px-2 text-xs font-semibold whitespace-nowrap tabular [&_svg]:size-3";
const daysText = (d: number) => (d === 0 ? "Today" : plural(d, "day"));

/**
 * The Analytics page's Flow: how work moves through a manager's projects.
 * Number tiles, the task journey with what sits in each step now, then
 * throughput, where accepted work came from, on time, review time and
 * workload. One period and one filter (a project or a person) drive it all;
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
    const [period, setPeriod] = React.useState<Period>(90);
    const [filter, setFilter] = React.useState("all");
    const [step, setStep] = React.useState(2);
    const [showAll, setShowAll] = React.useState(false);
    const [table, setTable] = React.useState(false);
    const [lit, setLit] = React.useState<string | null>(null);
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
    const s = React.useMemo(() => flowSummary(scoped.tasks, scoped.moves, today, period), [scoped, today, period]);
    const from = addDays(today, -(period - 1));
    const scopeName = !scope ? null : scope.kind === "project" ? projectOf.get(scope.id)?.title : personOf.get(scope.id)?.name;
    const pick = (f: string) => {
        setFilter((cur) => (cur === f ? "all" : f));
        setShowAll(false);
        root.current?.scrollIntoView({ behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
    };

    // Numbers for the tiles.
    const total = journeyDays(s.now.steps), totalBefore = journeyDays(s.before.steps);
    const rate = (x: number, y: number) => (y ? (x / y) * 100 : null);

    // Where accepted work came from: by project, or by person inside one project.
    const byPerson = scope?.kind === "project";
    const slices: Slice[] = React.useMemo(() => {
        const counts = new Map<string, number>();
        for (const t of acceptedIn(scoped.tasks, from, today)) {
            const key = byPerson ? t.assigned_to ?? "none" : t.project_id;
            counts.set(key, (counts.get(key) ?? 0) + 1);
        }
        const order = byPerson ? data.crew.map((p) => p.id) : data.projects.map((p) => p.id);
        const named = order.slice(0, 4).filter((id) => counts.get(id)).map((id) => ({ key: id, label: (byPerson ? personOf.get(id)?.name : projectOf.get(id)?.title) ?? "", value: counts.get(id)!, color: (byPerson ? personOf.get(id)?.color : projectOf.get(id)?.color) ?? OTHER }));
        const rest = [...counts.entries()].filter(([id]) => !named.some((n) => n.key === id)).reduce((a, [, v]) => a + v, 0);
        return rest ? [...named, { key: "other", label: byPerson ? "Others" : "Other projects", value: rest, color: OTHER }] : named;
    }, [scoped, from, today, byPerson, data, personOf, projectOf]);

    // Workload: everyone's open work (inside the chosen project, when there is one).
    const base = byPerson ? scoped : data;
    const workload = React.useMemo(() => {
        const team = daysPerTask(base.tasks, base.moves, today, period);
        const rows = data.crew.map((p) => {
            const mine = scopeFlow(base.tasks, base.moves, (t) => t.assigned_to === p.id);
            const open = openNow(mine.tasks, mine.moves, today).map((l) => l.length);
            const inPeriod = mine.moves.filter((m) => isoDateIn(m.at) >= from);
            const submitted = inPeriod.filter((m) => m.to === "review").length, back = inPeriod.filter((m) => m.from === "review" && m.to === "in_progress").length;
            return { person: p, open, late: openLoad(mine.tasks, today).late, pace: daysPerTask(mine.tasks, mine.moves, today, period), submitted, back };
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
    const [d0, d1] = s.now.steps;
    const slowest = d0 !== null && d1 !== null && Math.max(d0, d1) > 0 ? (d1 >= d0 ? 1 : 0) : -1;
    // A floor so 0-day steps still get a share of the row (all zeros = equal thirds) and the loop maths never divides by 0.
    const grow = s.now.steps.map((d) => Math.max(d ?? 1, 0.5)), sum = grow.reduce((a, b) => a + b, 0);
    const mid1 = ((grow[0] + grow[1] / 2) / sum) * 100, mid2 = ((grow[0] + grow[1] + grow[2] / 2) / sum) * 100;
    const list = s.open[step], shown = showAll ? list : list.slice(0, 5);
    const onTimeTotal = s.now.accepted, late = onTimeTotal - s.now.onTime;

    return (<div ref={root} className="relative scroll-mt-6">
      {before}
      <OverviewHeader title={title} sub={sub} actions={<div className="flex flex-wrap items-center gap-2">
          <div role="group" aria-label="Period" className="inline-flex rounded-xl bg-surface p-[3px] shadow-[0_0_0_1px_var(--line)]">
            {([30, 90] as const).map((d) => <button key={d} type="button" aria-pressed={period === d} onClick={() => setPeriod(d)} className={cn("h-8 min-w-13 rounded-[9px] px-3 text-[13px] font-semibold transition-colors", period === d ? "bg-ink text-surface" : "text-ink-tertiary hover:text-ink", focusRing)}>{d}D</button>)}
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

      {/* Number tiles */}
      <div className="materialize mt-6 grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5" style={stagger(1)}>
        <Tile label="Accepted" value={s.now.accepted} unit="tasks" delta={<Delta now={s.now.accepted} before={s.before.accepted} worseWhenUp={false} whole/>} spark={s.weekly.accepted}/>
        <Tile label="To get accepted" value={total ?? "–"} unit={total === null ? "" : "days"} delta={<Delta now={total} before={totalBefore} unit=" d"/>} spark={s.weekly.journey}/>
        <Tile label={`Waiting for ${you}`} value={s.now.steps[2] ?? "–"} unit={s.now.steps[2] === null ? "" : "days"} delta={<Delta now={s.now.steps[2]} before={s.before.steps[2]} unit=" d"/>} spark={s.weekly.review}/>
        <Tile label="Sent back" value={s.now.sentBack} unit={`of ${s.now.submitted}`} delta={<Delta now={rate(s.now.sentBack, s.now.submitted)} before={rate(s.before.sentBack, s.before.submitted)} unit=" pts" whole/>} spark={s.weekly.sentBack}/>
        <Tile label="Finished on time" value={s.now.onTime} unit={`of ${s.now.accepted}`} delta={<Delta now={rate(s.now.onTime, s.now.accepted)} before={rate(s.before.onTime, s.before.accepted)} worseWhenUp={false} unit=" pts" whole/>} spark={s.weekly.onTime}/>
      </div>

      {/* Task journey */}
      <OverviewCard id="journey-heading" title={scopeName ? `Task journey · ${scopeName}` : "Task journey"} sub="Typical days at each step · each dot is a task there now" className="materialize mt-4" style={stagger(2)} aside={<AgeKey/>}>
        <div className="px-5 pb-5 sm:px-6">
          <div className="mt-3 mb-2.5 grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px]">
            <div className="flex items-center gap-2.5">
              <span className="h-2 flex-1 translate-y-1 rounded-t border-[1.5px] border-b-0 border-line-strong max-lg:hidden" aria-hidden/>
              <span className="inline-flex items-center gap-2 text-[13.5px] font-semibold whitespace-nowrap">{total === null ? "No finished steps yet" : `${total} days in total`}<Delta now={total} before={totalBefore} unit=" d"/></span>
              <span className="h-2 flex-1 translate-y-1 rounded-t border-[1.5px] border-b-0 border-line-strong max-lg:hidden" aria-hidden/>
            </div>
          </div>
          <div className="grid gap-2 lg:grid-cols-[minmax(0,1fr)_150px]">
            <div className="flex flex-col gap-2 lg:flex-row">
              {[0, 1, 2].map((i) => <StepBox key={i} i={i} name={STEP_NAMES[i]} tag={TAGS[i]} days={s.now.steps[i]} before={s.before.steps[i]} open={s.open[i]} grow={grow[i]} pressed={step === i} flag={i === 2 ? `${your} step` : i === slowest ? "Slowest" : null} projectOf={projectOf} personOf={personOf} onClick={() => { setStep(i); setShowAll(false); }}/>)}
            </div>
            <div className="flex flex-col gap-2.5 rounded-2xl bg-success-soft p-3.5">
              <span className="text-[13.5px] font-semibold">Accepted<span className="block text-xs font-normal text-ink-tertiary">Done</span></span>
              <b className="text-[32px] leading-none font-semibold tracking-[-0.035em] text-success tabular">{s.now.accepted}<small className="ml-1 text-[13.5px] font-medium tracking-normal text-ink-tertiary">tasks</small></b>
              <span className="mt-auto text-[12.5px] text-ink-secondary">last {period} days</span>
            </div>
          </div>
          <div className="grid lg:grid-cols-[minmax(0,1fr)_150px] lg:gap-2">
            <div className="relative py-3 lg:h-14 lg:py-0">
              {s.now.submitted ? <span className="absolute top-1.5 h-6 rounded-b-[14px] border-[1.5px] border-t-0 border-dashed border-copper transition-[left,width] duration-500 before:absolute before:-top-0.75 before:-left-1.5 before:border-x-[5px] before:border-b-[7px] before:border-x-transparent before:border-b-copper before:content-[''] max-lg:hidden" style={{ left: `${mid1}%`, width: `${mid2 - mid1}%` }} aria-hidden/> : null}
              <span className="inline-flex items-center gap-1.5 rounded-full bg-brand-soft px-3 py-1 text-[12.5px] font-semibold text-brand lg:absolute lg:top-7 lg:-translate-x-1/2 lg:whitespace-nowrap" style={{ left: `${(mid1 + mid2) / 2}%` }}>
                <Undo2 className="size-3.5" aria-hidden/>
                {s.now.submitted ? <>{s.now.sentBack} of {s.now.submitted} sent back{s.reworkDays !== null ? ` · +${s.reworkDays} d each` : ""}</> : "Nothing submitted for review yet"}
              </span>
            </div>
          </div>
          <div id="flow-step-tasks" className="overflow-hidden rounded-2xl bg-surface-subtle shadow-[0_0_0_1px_var(--line)]" aria-live="polite">
            <div className="flex items-center justify-between gap-2 px-4 pt-3 pb-2"><h3 className="text-sm font-semibold">{STEP_NAMES[step]}</h3><span className="text-[13px] text-ink-tertiary">{plural(list.length, "task")} · longest wait first</span></div>
            {list.length === 0 ? <p className="border-t border-line px-4 py-3.5 text-sm text-ink-tertiary">Nothing here right now.</p> : shown.map((o) => <TaskRow key={o.task.id} o={o} viewer={viewer} projectOf={projectOf} personOf={personOf}/>)}
            {list.length > 5 ? <button type="button" onClick={() => setShowAll((v) => !v)} className={cn("block w-full border-t border-line px-4 py-2.5 text-left text-[13px] font-semibold text-brand hover:bg-brand-soft", focusRing)}>{showAll ? "Show fewer" : `Show all ${list.length}`}</button> : null}
          </div>
        </div>
      </OverviewCard>

      {/* Throughput */}
      <OverviewCard id="throughput-heading" title="Throughput" sub="Tasks accepted each week" className="materialize mt-4" style={stagger(3)} aside={<div className="flex flex-wrap items-center gap-x-3.5 gap-y-1.5 text-[12.5px] text-ink-secondary">
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-copper" aria-hidden/>Last {period} days</span>
          <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-ink-tertiary" aria-hidden/>Period before</span>
          <button type="button" aria-pressed={table} onClick={() => setTable((v) => !v)} className={cn("inline-flex h-[30px] items-center gap-1.5 rounded-full bg-surface-sunken px-3 font-medium hover:text-ink", focusRing)}>{table ? <><ChartLine className="size-3.5" aria-hidden/>Chart</> : <><Table2 className="size-3.5" aria-hidden/>Table</>}</button>
        </div>}>
        <Big value={s.now.accepted} label="accepted" delta={<Delta now={s.now.accepted} before={s.before.accepted} worseWhenUp={false} whole/>}/>
        <div className="px-4 pt-3 pb-5 sm:px-5">
          {table ? (<table className="w-full text-[13px] tabular">
              <thead><tr className="text-left text-ink-tertiary"><th className="px-2.5 py-1.5 font-medium">Week of</th><th className="px-2.5 py-1.5 text-right font-medium">Accepted</th><th className="px-2.5 py-1.5 text-right font-medium">Period before</th></tr></thead>
              <tbody>{s.weeks.map((w, i) => <tr key={w} className="border-t border-line"><td className="px-2.5 py-1.5">{formatDate(w, { month: "short", day: "numeric" })}</td><td className="px-2.5 py-1.5 text-right">{s.weekly.accepted[i]}</td><td className="px-2.5 py-1.5 text-right">{s.weekly.acceptedBefore[i]}</td></tr>)}</tbody>
            </table>) : <AreaChart values={s.weekly.accepted} before={s.weekly.acceptedBefore} weeks={s.weeks}/>}
        </div>
      </OverviewCard>

      <div className="mt-4 grid items-start gap-4 lg:grid-cols-2">
        {/* Where accepted work came from */}
        <OverviewCard id="share-heading" title={byPerson ? "By crew member" : "By project"} sub="Where accepted work came from · click one to focus" className="materialize" style={stagger(4)}>
          {slices.length === 0 ? <p className="px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6">Nothing accepted in the last {period} days.</p> : (<div className="grid items-center gap-5 px-5 pt-3 pb-5 sm:grid-cols-[168px_minmax(0,1fr)] sm:px-6">
              <div className="relative mx-auto size-[168px]">
                <Donut slices={slices} lit={lit}/>
                <div className="absolute inset-0 grid place-content-center text-center"><b className="text-[30px] leading-none font-semibold tracking-[-0.03em] tabular">{s.now.accepted}</b><span className="mt-1 text-xs text-ink-tertiary">accepted</span></div>
              </div>
              <div className="grid gap-0.5">
                {slices.map((sl) => {
                    const f = sl.key === "other" || sl.key === "none" ? null : byPerson ? `u:${sl.key}` : `p:${sl.key}`;
                    const body = (<>
                      <span className="size-2.5 rounded-[3px]" style={{ background: sl.color }} aria-hidden/>
                      <span className="truncate text-[13px] font-semibold">{sl.label}</span>
                      <span className="text-[13px] font-semibold tabular">{sl.value} <span className="font-medium text-ink-tertiary">of {s.now.accepted}</span></span>
                      <span className="col-span-2 col-start-2 h-1 overflow-hidden rounded-full bg-surface-sunken"><span className="chart-widen block h-full rounded-full" style={{ width: `${(sl.value / s.now.accepted) * 100}%`, background: sl.color }}/></span>
                    </>);
                    const cls = "grid grid-cols-[10px_minmax(0,1fr)_auto] items-center gap-x-2.5 gap-y-1.5 rounded-[10px] px-2.5 py-2 text-left";
                    return f ? <button key={sl.key} type="button" aria-pressed={filter === f} onClick={() => pick(f)} onPointerEnter={() => setLit(sl.key)} onPointerLeave={() => setLit(null)} onFocus={() => setLit(sl.key)} onBlur={() => setLit(null)} className={cn(cls, "transition-colors hover:bg-surface-subtle aria-pressed:bg-brand-soft", focusRing)}>{body}</button> : <div key={sl.key} className={cls} onPointerEnter={() => setLit(sl.key)} onPointerLeave={() => setLit(null)}>{body}</div>;
                })}
              </div>
            </div>)}
        </OverviewCard>

        {/* On time */}
        <OverviewCard id="ontime-heading" title="On time" sub="Accepted tasks finished by their due date" className="materialize" style={stagger(5)}>
          <Big value={s.now.onTime} label={`of ${onTimeTotal}`} delta={<Delta now={rate(s.now.onTime, s.now.accepted)} before={rate(s.before.onTime, s.before.accepted)} worseWhenUp={false} unit=" pts" whole/>}/>
          {onTimeTotal ? (<>
              <div className="mx-5 mt-3.5 flex h-2.5 gap-[3px] sm:mx-6" role="img" aria-label={`${s.now.onTime} on time, ${late} late`}>
                {s.now.onTime ? <span className="chart-widen rounded-full bg-stage-done" style={{ flex: s.now.onTime }}/> : null}
                {late ? <span className="chart-widen rounded-full bg-stage-late" style={{ flex: late }}/> : null}
              </div>
              <div className="flex gap-4 px-5 pt-2.5 text-[12.5px] text-ink-secondary sm:px-6">
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-done" aria-hidden/><b className="font-semibold text-ink tabular">{s.now.onTime}</b> on time</span>
                <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-stage-late" aria-hidden/><b className="font-semibold text-ink tabular">{late}</b> late</span>
              </div>
            </>) : null}
          <p className="px-5 pt-5 pb-1.5 text-[12.5px] font-semibold text-ink-tertiary sm:px-6">In progress the longest</p>
          {s.open[1].length === 0 ? <p className="px-5 pb-5 text-sm text-ink-tertiary sm:px-6">Nothing in progress.</p> : (<ul className="pb-2">
              {s.open[1].slice(0, 4).map((o) => {
                    const p = projectOf.get(o.task.project_id), who = o.task.assigned_to ? personOf.get(o.task.assigned_to) : null;
                    return (<li key={o.task.id} className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-3 border-t border-line px-5 py-2.5 sm:px-6">
                      {who ? <Face person={asMember(who)} size={30}/> : <span className="size-[30px] rounded-full bg-surface-sunken" aria-hidden/>}
                      <span className="min-w-0"><span className="block truncate text-[13.5px] font-semibold">{o.task.title}</span><span className="flex min-w-0 items-center gap-1.5 text-xs text-ink-tertiary"><span className="size-2 shrink-0 rounded-full" style={{ background: p?.color ?? OTHER }} aria-hidden/><span className="truncate">{p?.title}{who ? ` · ${who.name}` : ""}</span></span></span>
                      <span className={cn("text-right text-[15px] leading-tight font-semibold tabular", o.days >= 7 && "text-danger")}>{o.days} d<small className="block text-[11.5px] font-medium text-ink-tertiary">in progress</small></span>
                    </li>);
                })}
            </ul>)}
        </OverviewCard>

        {/* Review time */}
        <OverviewCard id="review-heading" title={`${your} review time`} sub={`Days a submission waited for ${you}, each week`} className="materialize" style={stagger(6)}>
          <Big value={s.now.steps[2] ?? "–"} label={s.now.steps[2] === null ? "nothing answered yet" : "days typical"} delta={<Delta now={s.now.steps[2]} before={s.before.steps[2]} unit=" d"/>}/>
          <div className="px-4 pt-4 pb-5 sm:px-5"><WeekBars values={s.weekly.review} weeks={s.weeks} typical={s.now.steps[2]} tip={(v) => `${v} days waiting for ${you}`}/></div>
        </OverviewCard>

        {/* Workload */}
        <OverviewCard id="workload-heading" title="Workload" sub={workload.team === null ? "Open tasks per person" : `Open tasks per person · days per task against the team’s ${workload.team}`} className="materialize" style={stagger(7)} aside={<span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-secondary">
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

function Tile({ label, value, unit, delta, spark }: { label: string; value: number | string; unit: string; delta: React.ReactNode; spark: (number | null)[] }) {
    return (<div className="grid min-w-0 grid-cols-[minmax(0,1fr)_auto] items-end gap-x-2.5 rounded-2xl px-4 py-3.5 material">
      <p className="col-span-2 text-[12.5px] font-medium text-ink-tertiary">{label}</p>
      <div className="min-w-0">
        <p className="mt-1.5 text-[26px] leading-[1.1] font-semibold tracking-[-0.03em] whitespace-nowrap text-ink tabular">{value}{unit ? <small className="ml-1 text-[13px] font-medium tracking-normal text-ink-tertiary">{unit}</small> : null}</p>
        <div className="mt-2 h-[22px]">{delta}</div>
      </div>
      <Spark values={spark}/>
    </div>);
}

function Big({ value, label, delta }: { value: number | string; label: string; delta: React.ReactNode }) {
    return (<div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 px-5 pt-1 sm:px-6">
      <b className="text-[32px] leading-none font-semibold tracking-[-0.035em] text-ink tabular">{value}</b>
      <span className="text-[13.5px] text-ink-tertiary">{label}</span>
      {delta}
    </div>);
}

function AgeKey() {
    return (<span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-secondary">
      <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", AGE_BG.fresh)} aria-hidden/>Under 3 days</span>
      <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", AGE_BG.aging)} aria-hidden/>3 to 6 days</span>
      <span className="inline-flex items-center gap-1.5"><span className={cn("size-2.5 rounded-[3px]", AGE_BG.stale)} aria-hidden/>A week or more</span>
    </span>);
}

type ProjectMap = Map<string, { id: string; title: string; active: boolean; color: string }>;
type PersonMap = Map<string, Person & { color: string }>;

/** One step of the journey: typical days, its change, a dot per task there now. Pressing it lists those tasks below. */
function StepBox({ i, name, tag, days, before, open, grow, pressed, flag, projectOf, personOf, onClick }: {
    i: number; name: string; tag: string; days: number | null; before: number | null; open: OpenTask[]; grow: number; pressed: boolean; flag: string | null;
    projectOf: ProjectMap; personOf: PersonMap; onClick: () => void;
}) {
    const mine = i === 2, stale = open.filter((o) => o.days >= 7).length;
    return (<button type="button" aria-pressed={pressed} aria-controls="flow-step-tasks" onClick={onClick} style={{ flexGrow: grow }} className={cn(
            "flex min-w-0 basis-0 flex-col gap-2.5 rounded-2xl px-4 pt-3.5 pb-3 text-left transition-[flex-grow,box-shadow,translate,background-color] duration-500 ease-[var(--ease-spring)] hover:-translate-y-px lg:min-w-40",
            mine ? "bg-brand-soft shadow-[0_0_0_1.5px_rgb(217_119_6/0.45)]" : "bg-surface-subtle shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong),0_14px_28px_-18px_rgb(14_18_34/0.3)]",
            pressed && (mine ? "shadow-[0_0_0_2px_var(--copper)]" : "shadow-[0_0_0_2px_var(--ink)]"),
            focusRing)}>
      <span className="flex items-start justify-between gap-2">
        <span><span className="block text-[13.5px] font-semibold text-ink">{name}</span><span className="block text-xs text-ink-tertiary">{tag}</span></span>
        {flag ? <span className={cn("rounded-full px-2 text-[11.5px] leading-[22px] font-semibold whitespace-nowrap", mine ? "bg-brand text-white" : "bg-ink text-surface")}>{flag}</span> : null}
      </span>
      <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1.5">
        <b className="text-[32px] leading-none font-semibold tracking-[-0.035em] text-ink tabular">{days ?? "–"}{days !== null ? <small className="ml-1 text-[13.5px] font-medium tracking-normal text-ink-tertiary">days</small> : null}</b>
        <Delta now={days} before={before} unit=" d"/>
      </span>
      <span className="flex min-h-[22px] flex-wrap content-start gap-1" aria-hidden>
        {open.length === 0 ? <span className="text-[12.5px] text-ink-tertiary">Empty</span> : open.map((o) => {
                const p = projectOf.get(o.task.project_id), who = o.task.assigned_to ? personOf.get(o.task.assigned_to)?.name : null;
                return <i key={o.task.id} className={cn("size-[9px] rounded-[3px] transition-transform hover:scale-150", AGE_BG[age(o.days)])} data-tip={`${o.task.title}\n${p?.title ?? ""} · ${who ?? "Unassigned"}\n${o.days === 0 ? "Arrived today" : `${plural(o.days, "day")} in this step`}`}/>;
            })}
      </span>
      <span className={cn("mt-auto flex items-center justify-between gap-2 border-t pt-2.5 text-[12.5px] text-ink-secondary", mine ? "border-copper/20" : "border-line")}>
        <span><b className="font-semibold text-ink tabular">{open.length}</b> {mine ? "waiting" : "here"}{stale ? <span className="text-danger"> · {stale} over a week</span> : null}</span>
        <ChevronDown className={cn("size-3.5 transition-transform duration-300", pressed ? "rotate-180 text-ink" : "text-ink-tertiary")} aria-hidden/>
      </span>
    </button>);
}

function TaskRow({ o, viewer, projectOf, personOf }: { o: OpenTask; viewer: Viewer; projectOf: ProjectMap; personOf: PersonMap }) {
    const p = projectOf.get(o.task.project_id), who = o.task.assigned_to ? personOf.get(o.task.assigned_to) : null, a = age(o.days);
    return (<div className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-x-3.5 gap-y-1 border-t border-line px-4 py-2.5 text-[13.5px] sm:grid-cols-[minmax(0,1fr)_170px_84px_auto]">
      <span className="min-w-0"><span className="block truncate font-semibold">{o.task.title}</span><span className="flex min-w-0 items-center gap-1.5 text-[12.5px] text-ink-tertiary"><span className="size-2 shrink-0 rounded-full" style={{ background: p?.color ?? OTHER }} aria-hidden/><span className="truncate">{p?.title}</span></span></span>
      <span className="flex min-w-0 items-center gap-2 text-[13px] max-sm:hidden">{who ? <><Face person={asMember(who)} size={22}/><span className="truncate">{who.name}</span></> : <span className="text-ink-tertiary">Unassigned</span>}</span>
      <span className={cn("inline-flex items-center gap-1.5 font-semibold tabular", a === "stale" && "text-danger")}><span className={cn("size-2 rounded-[2.5px]", AGE_BG[a])} aria-hidden/>{daysText(o.days)}</span>
      {viewer === "pm" ? (o.step === 2
            ? <Link href={`${projectReviewPath(o.task.project_id)}?task=${o.task.id}`} className={cn("justify-self-end rounded-full bg-brand px-3 text-[12.5px] leading-7 font-semibold text-white hover:bg-brand-hover max-sm:col-span-2 max-sm:justify-self-start", focusRing)}>Review</Link>
            : <Link href={`${projectBoardPath(o.task.project_id)}?task=${o.task.id}`} className={cn("justify-self-end rounded-full bg-surface-sunken px-3 text-[12.5px] leading-7 font-semibold text-ink hover:bg-line max-sm:col-span-2 max-sm:justify-self-start", focusRing)}>Open</Link>)
        : <span className="max-sm:hidden"/>}
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
