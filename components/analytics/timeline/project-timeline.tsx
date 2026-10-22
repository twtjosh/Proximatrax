"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { CalendarCheck2, CalendarRange, ChevronLeft, ChevronRight, Flag, Hourglass, Play } from "lucide-react";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { daysBetween, formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { buildPeriods, groupMoves, periodMarks, periodOf, periodStats, timelineSpan, type PeriodMarks, type TimelineData, type TimelineMove, type TimelineProject, type TimelineTask, type Unit } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";
import { ProjectPicker, type ProjectOption } from "./project-picker";
import { ActivityFilters, ActivityHistory, KindDots, KindLegend, matches, NO_FILTERS, PeriodFlags, QuickStats, type Filters, type TimelineModel } from "./timeline-parts";

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const long = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });

/** Where a project stands against its due date, in the words the Projects table uses. */
function standing(p: TimelineProject, today: string): ProjectOption["status"] {
    if (p.completedAt) {
        const late = daysBetween(p.end, isoDateIn(p.completedAt));
        return late > 0 ? { text: `Delivered ${plural(late, "day")} late`, tone: "late" } : { text: "Delivered on time", tone: "done" };
    }
    const over = daysBetween(p.end, today);
    return over > 0 ? { text: `${plural(over, "day")} past end date`, tone: "late" } : { text: `${plural(-over, "day")} left`, tone: "ok" };
}
const CHIP = { ok: "bg-info-soft text-info", late: "bg-danger-soft text-danger", done: "bg-success-soft text-success" } as const;
const HEALTH_PILL = { on_track: "bg-success-soft text-success", at_risk: "bg-warning-soft text-warning", off_track: "bg-danger-soft text-danger" } as const;
const DIAMOND = { delivered: "border-stage-done bg-stage-done", due: "border-ink-secondary", missed: "border-danger" } as const;

/**
 * The Analytics page's Project timeline: one project's life in days, weeks
 * or months, with the phases due, delivered or missed and the PM's status
 * update marked on each, and the full activity of the period chosen.
 */
export function ProjectTimeline({ data, tasks, moves, viewer, today }: {
    data: TimelineData;
    tasks: TimelineTask[];
    moves: TimelineMove[];
    viewer: "pm" | "owner";
    today: string;
}) {
    // Active projects first, newest start first; then delivered, most recent first.
    const ordered = React.useMemo(() => [...data.projects].sort((a, b) => Number(b.active) - Number(a.active)
        || (a.active ? b.start.localeCompare(a.start) : (b.completedAt ?? b.end).localeCompare(a.completedAt ?? a.end))), [data.projects]);
    const [projectId, setProjectId] = React.useState(ordered[0]?.id ?? "");
    const [unit, setUnit] = React.useState<Unit>("week");
    const [chosen, setChosen] = React.useState<{ key: string; index: number } | null>(null);
    const [filters, setFilters] = React.useState<Filters>(NO_FILTERS);

    const project = ordered.find((p) => p.id === projectId) ?? ordered[0];
    const options = React.useMemo<ProjectOption[]>(() => ordered.map((p) => {
        const own = tasks.filter((t) => t.project_id === p.id);
        return { id: p.id, title: p.title, client: p.client, dates: `${short(p.start)} – ${long(p.end)}`, accepted: own.filter((t) => t.stage === "done").length, total: own.length, status: standing(p, today) };
    }), [ordered, tasks, today]);
    const base = React.useMemo(() => {
        if (!project) return null;
        const log = data.log.filter((e) => e.project_id === project.id);
        const own = tasks.filter((t) => t.project_id === project.id), ids = new Set(own.map((t) => t.id));
        const byTask = groupMoves(moves.filter((m) => ids.has(m.task_id)));
        const span = timelineSpan(project, log, today);
        const periods = buildPeriods(span, project.end, unit, today);
        const byPeriod = periods.map(() => [] as typeof log);
        for (const e of log) {
            const i = periodOf(periods, isoDateIn(e.created_at));
            if (i >= 0) byPeriod[i].push(e);
        }
        const phases = data.milestones.filter((m) => m.project_id === project.id);
        return {
            span, periods, byPeriod,
            stats: periods.map((p) => periodStats(p, own, byTask, log, today)),
            marks: periods.map((p, i) => periodMarks(p, phases, byPeriod[i], today)),
        };
    }, [data.log, data.milestones, project, tasks, moves, today, unit]);

    if (!project || !base) {
        return (<OverviewCard id="timeline-heading" title="Project timeline" className="materialize mt-6" style={stagger(1)}>
          <p className="px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6">No projects yet. Each project’s weeks fill in here as work happens.</p>
        </OverviewCard>);
    }

    const { periods } = base;
    const key = `${project.id}:${unit}`;
    const todayIndex = periodOf(periods, today);
    const lastActive = base.stats.findLastIndex((s) => s.activities > 0);
    const fallback = todayIndex >= 0 ? todayIndex : lastActive >= 0 ? lastActive : periods.length - 1;
    const selected = chosen?.key === key ? Math.min(chosen.index, periods.length - 1) : fallback;
    const select = (i: number) => setChosen({ key, index: Math.max(0, Math.min(i, periods.length - 1)) });
    const switchUnit = (u: Unit) => {
        if (u === unit) return;
        // Keep looking at the same stretch of time: the new period holding the old one's start.
        const anchor = periods[selected]?.from ?? today;
        setUnit(u);
        setChosen({ key: `${project.id}:${u}`, index: Math.max(0, periodOf(buildPeriods(base.span, project.end, u, today), anchor)) });
    };
    const switchProject = (id: string) => {
        setProjectId(id);
        setChosen(null);
        setFilters(NO_FILTERS);
    };

    const model: TimelineModel = {
        project, unit, periods, stats: base.stats, byPeriod: base.byPeriod,
        shown: base.byPeriod[selected].filter((e) => matches(e, filters)),
        selected, select, dueIndex: periodOf(periods, project.end),
        people: data.people, viewer, filters, setFilters,
    };
    const planned = Math.max(1, daysBetween(project.start, project.end) + 1);
    const status = standing(project, today);

    return (<OverviewCard id="timeline-heading" title="Project timeline" sub="Every day, week or month of one project and what happened in it · click a period to open its activity" className="materialize mt-6" style={stagger(1)} aside={<KindLegend/>}>
      <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4 px-5 pt-2 pb-5 sm:px-6">
        <div className="grid min-w-0 gap-2.5">
          <ProjectPicker projects={options} value={project.id} onChange={switchProject}/>
          <dl className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px] text-ink-secondary">
            <Meta icon={CalendarRange} label="Start" value={long(project.start)}/>
            <Meta icon={CalendarCheck2} label="Due" value={long(project.end)}/>
            <Meta icon={Hourglass} label="Duration" value={`${plural(planned, "day")} · ${plural(Math.ceil(planned / 7), "week")}`}/>
            <span className={cn("rounded-full px-2 text-xs leading-[22px] font-semibold", CHIP[status.tone])}>{status.text}</span>
          </dl>
        </div>
        <Segmented label="View by" value={unit} onChange={(v) => switchUnit(v as Unit)} options={[{ value: "day", label: "Daily" }, { value: "week", label: "Weekly" }, { value: "month", label: "Monthly" }]}/>
      </div>
      <Strip model={model} marks={base.marks}/>
      <div className="grid items-stretch gap-4 px-5 pt-3 pb-5 sm:px-6 lg:grid-cols-[minmax(0,1fr)_17.5rem]">
        <div className="relative min-w-0 lg:min-h-[26rem]"><ActivityHistory model={model} className="lg:absolute lg:inset-0"/></div>
        <div className="grid content-start gap-4">
          <ActivityFilters model={model}/>
          <QuickStats model={model}/>
        </div>
      </div>
    </OverviewCard>);
}

/**
 * The periods as a carousel: a title row with the count, a key for the
 * markers and arrows that page through; no scrollbar, and the edges fade only
 * where more periods are hidden. A marked period explains its markers on hover
 * through the page's tooltip (`data-tip`).
 */
function Strip({ model, marks }: { model: TimelineModel; marks: PeriodMarks[] }) {
    const ref = React.useRef<HTMLDivElement>(null);
    const [edge, setEdge] = React.useState({ l: false, r: false });
    const measure = React.useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth - 2;
        setEdge((e) => (e.l === el.scrollLeft > 2 && e.r === el.scrollLeft < max ? e : { l: el.scrollLeft > 2, r: el.scrollLeft < max }));
    }, []);
    React.useEffect(() => {
        const el = ref.current;
        if (!el) return;
        measure();
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [measure, model.periods]);
    // Bring the selected period to the middle without scrolling the page.
    React.useEffect(() => {
        const el = ref.current, item = el?.querySelector<HTMLElement>(`[data-period="${model.selected}"]`)?.parentElement;
        if (!el || !item) return;
        el.scrollTo({ left: item.offsetLeft - el.clientWidth / 2 + item.offsetWidth / 2, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    }, [model.selected, model.unit, model.project.id]);
    const page = (dir: number) => {
        const el = ref.current;
        el?.scrollBy({ left: dir * Math.max(160, el.clientWidth - 140), behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    };
    const mask = edge.l && edge.r ? "linear-gradient(to right, transparent, #000 72px, #000 calc(100% - 72px), transparent)"
        : edge.r ? "linear-gradient(to right, #000 calc(100% - 72px), transparent)" : edge.l ? "linear-gradient(to right, transparent, #000 72px)" : undefined;
    const { periods, stats } = model, units = `${model.unit}s`;
    const max = Math.max(1, ...stats.map((s) => s.activities));
    const startIndex = Math.max(0, periodOf(periods, model.project.start));
    const arrow = cn("grid size-8 cursor-pointer place-items-center rounded-full bg-surface text-ink shadow-[0_0_0_1px_var(--line)] transition-[background-color,box-shadow,opacity,scale] duration-150 hover:not-disabled:bg-surface-subtle hover:not-disabled:shadow-[0_0_0_1px_var(--line-strong),0_6px_14px_-8px_rgb(14_18_34/0.35)] active:not-disabled:scale-95 disabled:cursor-default disabled:opacity-35", focusRing);

    return (<>
      <div className="flex items-center justify-between gap-3 px-5 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-[18px] gap-y-1">
          <p className="text-[13px] text-ink-tertiary"><b className="font-semibold text-ink tabular">{periods.length} {units}</b> · {short(periods[0].from)} – {long(periods[periods.length - 1].to)}</p>
          <span className="flex flex-wrap items-center gap-x-3.5 gap-y-1 text-xs text-ink-tertiary">
            <span className="inline-flex items-center gap-1.5"><Diamond state="delivered"/>Phase delivered</span>
            <span className="inline-flex items-center gap-1.5"><Diamond state="due"/>Phase due</span>
            <span className="inline-flex items-center gap-1.5"><Diamond state="missed"/>Phase missed</span>
            <span className="inline-flex items-center gap-1.5"><span className={cn("rounded-full px-1.5 text-[10.5px] leading-[18px] font-semibold", HEALTH_PILL.at_risk)}>At risk</span>PM’s status update</span>
          </span>
        </div>
        <span className="flex shrink-0 gap-1.5">
          <button type="button" disabled={!edge.l} onClick={() => page(-1)} aria-label={`Earlier ${units}`} className={arrow}><ChevronLeft className="size-4" aria-hidden/></button>
          <button type="button" disabled={!edge.r} onClick={() => page(1)} aria-label={`Later ${units}`} className={arrow}><ChevronRight className="size-4" aria-hidden/></button>
        </span>
      </div>
      <motion.div key={`${model.project.id}:${model.unit}`} ref={ref} onScroll={measure} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }}
        className="flex snap-x snap-proximity gap-2.5 overflow-x-auto overscroll-x-contain px-5 pt-8 pb-3 [scrollbar-width:none] sm:px-6 [&::-webkit-scrollbar]:hidden" style={{ maskImage: mask, WebkitMaskImage: mask }}>
        {periods.map((p, i) => {
            const s = stats[i], on = model.selected === i, m = marks[i];
            const lines = [...m.phases.map((ph) => ph.text), ...(m.health ? [`${m.health.label}${m.health.note ? `: “${m.health.note}”` : ""}`] : [])];
            return (<div key={p.from} className="relative shrink-0 snap-center">
              {i === startIndex ? <Marker icon={Play} text={`Start · ${short(model.project.start)}`}/> : null}
              {i === model.dueIndex ? <Marker icon={Flag} text={`Due · ${short(model.project.end)}`} right/> : null}
              <button type="button" data-period={i} aria-pressed={on} onClick={() => model.select(i)} data-tip={lines.length ? `${p.label} · ${p.range}\n${lines.join("\n")}` : undefined}
                aria-label={`${p.label}, ${p.range}, ${s.activities} ${s.activities === 1 ? "activity" : "activities"}${lines.length ? `. ${lines.join(". ")}` : ""}`}
                className={cn("flex w-[9.75rem] cursor-pointer flex-col gap-2 rounded-2xl px-3.5 py-3 text-left transition-[background-color,box-shadow,translate] duration-200 ease-out hover:-translate-y-0.5", focusRing,
                    on ? "bg-brand-soft shadow-[0_0_0_2px_var(--copper)]"
                        : p.beyond ? "bg-[color-mix(in_srgb,var(--danger-soft)_60%,var(--surface))] shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong),0_12px_24px_-16px_rgb(14_18_34/0.35)]"
                            : p.upcoming ? "bg-surface-subtle shadow-[inset_0_0_0_1px_var(--line)] hover:bg-surface"
                                : "bg-surface shadow-[0_0_0_1px_var(--line)] hover:shadow-[0_0_0_1px_var(--line-strong),0_12px_24px_-16px_rgb(14_18_34/0.35)]")}>
                <span className="flex items-start justify-between gap-1">
                  <span className={cn("text-[13.5px] font-semibold", on ? "text-brand-hover" : "text-ink")}>{p.label}</span>
                  <PeriodFlags period={{ ...p, upcoming: false, beyond: false }}/>
                </span>
                <span className="-mt-1.5 text-xs text-ink-tertiary tabular">{p.range}</span>
                <span className="-mt-0.5 flex min-h-[18px] items-center gap-1.5" aria-hidden>
                  {m.phases.map((ph, j) => <Diamond key={j} state={ph.state}/>)}
                  {m.health ? <span className={cn("rounded-full px-1.5 text-[10.5px] leading-[18px] font-semibold whitespace-nowrap", HEALTH_PILL[m.health.health])}>{m.health.label}</span> : null}
                </span>
                <span className="h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                  <span className={cn("block h-full rounded-full transition-[width] duration-500", on ? "bg-copper" : "bg-ink-tertiary/60")} style={{ width: `${(s.activities / max) * 100}%` }}/>
                </span>
                <span className="flex items-center justify-between gap-2 text-xs">
                  <KindDots kinds={s.kinds}/>
                  <span className={cn("tabular", s.activities ? "font-semibold text-ink-secondary" : "text-ink-tertiary")}>{p.upcoming ? (s.due ? `${s.due} due` : "–") : s.activities}</span>
                </span>
              </button>
            </div>);
        })}
      </motion.div>
    </>);
}

function Diamond({ state }: { state: keyof typeof DIAMOND }) {
    return <span className={cn("mx-px inline-block size-2.5 shrink-0 rotate-45 rounded-[2px] border-[1.5px]", DIAMOND[state])} aria-hidden/>;
}

function Marker({ icon: Icon, text, right }: { icon: typeof Flag; text: string; right?: boolean }) {
    return (<span className={cn("absolute -top-6 flex items-center gap-1 text-[11px] font-semibold whitespace-nowrap text-ink-secondary", right ? "right-1" : "left-1")}>
      <Icon className="size-3 fill-current" aria-hidden/>{text}
    </span>);
}

function Meta({ icon: Icon, label, value }: { icon: typeof Hourglass; label: string; value: string }) {
    return (<span className="inline-flex items-center gap-1.5">
      <Icon className="size-3.5 text-ink-tertiary" aria-hidden/>
      <dt className="text-ink-tertiary">{label}</dt>
      <dd className="font-medium text-ink tabular">{value}</dd>
    </span>);
}

/** A switch between a few options; the thumb slides to the chosen one. */
function Segmented({ label, value, options, onChange }: { label: string; value: string; options: { value: string; label: string }[]; onChange: (v: string) => void }) {
    return (<div role="radiogroup" aria-label={label} className="inline-flex rounded-xl bg-surface-sunken p-[3px]">
      {options.map((o) => {
            const on = o.value === value;
            return (<button key={o.value} type="button" role="radio" aria-checked={on} onClick={() => onChange(o.value)} className={cn("relative h-8 rounded-[9px] px-3.5 text-[13px] font-semibold transition-colors", on ? "text-ink" : "text-ink-tertiary hover:text-ink", focusRing)}>
              {on ? <motion.span layoutId="timeline-unit" className="absolute inset-0 rounded-[9px] bg-surface shadow-[0_1px_2px_rgb(14_18_34/0.08),0_0_0_1px_rgb(14_18_34/0.06)]" transition={{ type: "spring", stiffness: 500, damping: 38 }} aria-hidden/> : null}
              <span className="relative">{o.label}</span>
            </button>);
        })}
    </div>);
}
