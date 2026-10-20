"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { BadgeCheck, CalendarClock, CalendarX2, ChevronDown, ChevronLeft, ChevronRight, CircleCheck, CircleDashed, Clock3, Eye, ListChecks, Megaphone, MessageSquare, Paperclip, SlidersHorizontal, TriangleAlert, Users, Zap, type LucideIcon } from "lucide-react";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { StatusBadge } from "@/components/system/status-badge";
import { projectBoardPath } from "@/lib/constants";
import { formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { LOG_KINDS, logDetail, logKind, logSentence, type LogKind } from "@/lib/project-log";
import type { Period, PeriodStats, TimelineEntry, TimelinePerson, TimelineProject, Unit } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import type { TaskStage } from "@/types/enums";

/** Everything the timeline's panels draw from; the container works it out once. */
export type TimelineModel = {
    project: TimelineProject;
    unit: Unit;
    periods: Period[];
    stats: PeriodStats[];
    /** Log rows inside each period, oldest first, before filters. */
    byPeriod: TimelineEntry[][];
    /** The selected period's rows after the filters. */
    shown: TimelineEntry[];
    selected: number;
    select: (i: number) => void;
    /** Period holding the planned due date, or -1. */
    dueIndex: number;
    people: Record<string, TimelinePerson>;
    viewer: "pm" | "owner";
    filters: Filters;
    setFilters: (f: Filters) => void;
};
export type Filters = { kind: LogKind | ""; person: string };
export const NO_FILTERS: Filters = { kind: "", person: "" };

/** One colour and icon per kind of activity, used by the dots, the legend and the rows. */
export const KIND: Record<LogKind, { color: string; icon: LucideIcon; label: string }> = {
    update: { color: "var(--ink)", icon: Megaphone, label: "Updates" },
    review: { color: "var(--copper)", icon: BadgeCheck, label: "Reviews" },
    task: { color: "var(--stage-progress)", icon: ListChecks, label: "Tasks" },
    schedule: { color: "var(--stage-done)", icon: CalendarClock, label: "Schedule" },
    file: { color: "var(--series-2)", icon: Paperclip, label: "Files" },
    discussion: { color: "var(--series-3)", icon: MessageSquare, label: "Discussion" },
    team: { color: "var(--series-4)", icon: Users, label: "Team" },
};
const KIND_ORDER = LOG_KINDS.map((k) => k.kind);
const sortKinds = (kinds: LogKind[]) => [...kinds].sort((a, b) => KIND_ORDER.indexOf(a) - KIND_ORDER.indexOf(b));

const day = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });
const time = (instant: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(instant));
const weekday = (iso: string) => formatDate(iso, { weekday: "short", month: "short", day: "numeric" });
const activities = (n: number) => `${n} ${n === 1 ? "activity" : "activities"}`;
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const stageOf = (e: TimelineEntry): TaskStage | null => {
    if (e.action_type === "task_created") return "to_do";
    if (e.action_type !== "task_moved") return null;
    const to = String(e.details?.to ?? "");
    return to === "backlog" ? "to_do" : to in TASK_STAGE_TERMS ? (to as TaskStage) : null;
};

export function matches(e: TimelineEntry, f: Filters): boolean {
    return (!f.kind || logKind(e) === f.kind) && (!f.person || e.user_id === f.person);
}
const filterCount = (f: Filters) => [f.kind, f.person].filter(Boolean).length;

/** Dots for the kinds of activity in a period: colour carries the kind, the count beside them says it in text. */
export function KindDots({ kinds }: { kinds: LogKind[] }) {
    return (<span className="flex items-center gap-1" aria-hidden>
      {sortKinds(kinds).map((k) => <span key={k} className="size-1.5 rounded-full" style={{ background: KIND[k].color }}/>)}
    </span>);
}

export function KindLegend() {
    return (<span className="flex flex-wrap gap-x-3 gap-y-1 text-[12.5px] text-ink-secondary">
      {KIND_ORDER.map((k) => <span key={k} className="inline-flex items-center gap-1.5"><span className="size-2 rounded-full" style={{ background: KIND[k].color }} aria-hidden/>{KIND[k].label}</span>)}
    </span>);
}

/** Now, Due, Upcoming, Past due: what a period is, in small labels. */
export function PeriodFlags({ period, due, className }: { period: Period; due?: boolean; className?: string }) {
    return (<span className={cn("flex flex-wrap gap-1", className)}>
      {period.current ? <span className="rounded-full bg-copper px-1.5 text-[10.5px] leading-[18px] font-semibold text-white">Now</span> : null}
      {due ? <span className="rounded-full bg-ink px-1.5 text-[10.5px] leading-[18px] font-semibold text-surface">Due</span> : null}
      {period.beyond ? <span className="rounded-full bg-danger-soft px-1.5 text-[10.5px] leading-[18px] font-semibold text-danger">Past due</span> : null}
      {period.upcoming && !period.current ? <span className="rounded-full bg-surface-sunken px-1.5 text-[10.5px] leading-[18px] font-semibold text-ink-tertiary">Upcoming</span> : null}
    </span>);
}

function StepButtons({ model }: { model: TimelineModel }) {
    const last = model.periods.length - 1, noun = model.unit;
    const btn = cn("grid size-9 cursor-pointer place-items-center rounded-full bg-surface-sunken text-ink-secondary transition-colors hover:bg-line hover:text-ink disabled:cursor-not-allowed disabled:opacity-40", focusRing);
    return (<span className="flex items-center gap-1.5">
      <button type="button" disabled={model.selected <= 0} onClick={() => model.select(model.selected - 1)} aria-label={`Previous ${noun}`} className={btn}><ChevronLeft className="size-4" aria-hidden/></button>
      <button type="button" disabled={model.selected >= last} onClick={() => model.select(model.selected + 1)} aria-label={`Next ${noun}`} className={btn}><ChevronRight className="size-4" aria-hidden/></button>
    </span>);
}

/**
 * The selected period's activity: a fixed header with its range, count and
 * stepping, then the rows (by day for a month) scrolling beneath. Changing
 * period slides the list the way you moved.
 */
export function ActivityHistory({ model, className }: { model: TimelineModel; className?: string }) {
    const reduce = useReducedMotion();
    const p = model.periods[model.selected], s = model.stats[model.selected];
    const [prev, setPrev] = React.useState(model.selected);
    const [dir, setDir] = React.useState(0);
    if (prev !== model.selected) {
        setDir(model.selected > prev ? 1 : -1);
        setPrev(model.selected);
    }
    const rows = model.shown, filtered = filterCount(model.filters) > 0;
    const days = model.unit === "month" ? [...new Set(rows.map((e) => isoDateIn(e.created_at)))] : [];
    return (<section aria-label="Activity history" className={cn("flex min-w-0 flex-col overflow-hidden rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]", className)}>
      <header className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-line px-4 py-3 sm:px-5">
        <div className="min-w-0 flex-1">
          <h3 className="flex flex-wrap items-center gap-2 text-[15px] font-semibold text-ink">{p.label}<span className="font-normal text-ink-tertiary tabular">{p.range}</span><PeriodFlags period={p} due={model.selected === model.dueIndex}/></h3>
          <p className="text-[12.5px] text-ink-tertiary" aria-live="polite">{filtered ? `${rows.length} of ${activities(s.activities)} match the filters` : activities(s.activities)}</p>
        </div>
        <StepButtons model={model}/>
      </header>
      <div tabIndex={0} aria-label={`Activities in ${p.label}`} className={cn("min-h-0 flex-1 overflow-y-auto overscroll-contain [scrollbar-color:var(--line-strong)_transparent] [scrollbar-width:thin] max-lg:max-h-[30rem]", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
        <AnimatePresence mode="popLayout" initial={false} custom={dir}>
          <motion.div key={`${model.unit}-${model.selected}`} custom={dir} initial={reduce ? { opacity: 0 } : { opacity: 0, x: dir * 18 }} animate={{ opacity: 1, x: 0 }} exit={reduce ? { opacity: 0 } : { opacity: 0, x: dir * -18 }} transition={{ type: "spring", stiffness: 420, damping: 38 }}>
            {rows.length === 0 ? <EmptyHistory model={model} filtered={filtered}/> : model.unit === "month" ? days.map((d) => (<div key={d}>
                  <p className="sticky top-0 z-10 border-b border-line bg-surface-subtle/95 px-4 py-1.5 text-xs font-semibold text-ink-secondary backdrop-blur sm:px-5">{weekday(d)}</p>
                  <ul>{rows.filter((e) => isoDateIn(e.created_at) === d).map((e, i) => <ActivityRow key={`${e.created_at}-${i}`} e={e} model={model} withDay={false}/>)}</ul>
                </div>)) : <ul>{rows.map((e, i) => <ActivityRow key={`${e.created_at}-${i}`} e={e} model={model} withDay/>)}</ul>}
          </motion.div>
        </AnimatePresence>
      </div>
    </section>);
}

function EmptyHistory({ model, filtered }: { model: TimelineModel; filtered: boolean }) {
    const p = model.periods[model.selected], s = model.stats[model.selected];
    return (<div className="grid justify-items-center gap-2 px-6 py-12 text-center">
      <span className="grid size-11 place-items-center rounded-full bg-surface-sunken text-ink-tertiary" aria-hidden>{filtered ? <SlidersHorizontal className="size-5"/> : <CalendarX2 className="size-5"/>}</span>
      <p className="text-sm font-medium text-ink">{filtered ? "No activities match these filters." : p.upcoming ? "This period hasn’t started yet." : "No activities recorded during this period."}</p>
      {p.upcoming && s.due ? <p className="text-[13px] text-ink-tertiary">{plural(s.due, "task")} {s.due === 1 ? "is" : "are"} due in it.</p> : null}
      {filtered ? <button type="button" onClick={() => model.setFilters(NO_FILTERS)} className={cn("mt-1 rounded-full bg-surface-sunken px-3.5 py-1.5 text-[13px] font-medium hover:bg-line", focusRing)}>Clear filters</button> : null}
    </div>);
}

/** One thing that happened: what, the note it carried, who and when, the stage it left a task in, and the task to open. */
function ActivityRow({ e, model, withDay }: { e: TimelineEntry; model: TimelineModel; withDay: boolean }) {
    const kind = logKind(e), k = KIND[kind], who = model.people[e.user_id ?? ""], detail = logDetail(e), stage = stageOf(e);
    const taskId = typeof e.details?.task_id === "string" ? e.details.task_id : null;
    const sentBack = e.action_type === "task_moved" && e.details?.from === "review" && e.details?.to === "in_progress";
    return (<li className="group/row grid grid-cols-[32px_minmax(0,1fr)] items-start gap-x-3 gap-y-1.5 border-b border-line px-4 py-3 transition-colors last:border-b-0 hover:bg-surface-subtle sm:grid-cols-[32px_minmax(0,1fr)_auto] sm:px-5">
      <span className="grid size-8 place-items-center rounded-full" style={{ background: `color-mix(in srgb, ${k.color} 12%, transparent)`, color: k.color }} aria-hidden><k.icon className="size-4"/></span>
      <div className="min-w-0">
        <p className="text-[13.5px] leading-snug font-medium text-ink">{capital(logSentence(e))}</p>
        {detail ? <p className="mt-0.5 line-clamp-2 text-[12.5px] text-ink-secondary">“{detail}”</p> : null}
        <p className="mt-1.5 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-tertiary">
          {who ? <span className="inline-flex min-w-0 items-center gap-1.5"><Face person={{ id: e.user_id!, name: who.name, avatarUrl: who.avatarUrl, role: "" }} size={20}/><span className="font-medium text-ink-secondary">{who.name}</span><span>· {who.role}</span></span> : <span>Someone</span>}
          <span className="inline-flex items-center gap-1"><span className="size-1.5 rounded-full" style={{ background: k.color }} aria-hidden/>{k.label}</span>
        </p>
      </div>
      <div className="col-start-2 flex flex-wrap items-center gap-2 sm:col-start-3 sm:flex-col sm:items-end sm:gap-1.5">
        <span className="text-xs text-ink-tertiary tabular">{withDay ? `${weekday(isoDateIn(e.created_at))} · ` : ""}{time(e.created_at)}</span>
        <span className="flex items-center gap-1.5">
          {sentBack ? <StatusBadge tone="danger">Sent back</StatusBadge> : stage ? <StatusBadge tone={TASK_STAGE_TERMS[stage].tone}>{TASK_STAGE_TERMS[stage].label}</StatusBadge> : null}
          {model.viewer === "pm" && taskId ? <Link href={`${projectBoardPath(model.project.id)}?task=${taskId}`} className={cn("inline-flex h-6 items-center gap-1 rounded-full bg-surface-sunken px-2.5 text-xs font-medium text-ink opacity-80 transition-[opacity,background-color] group-hover/row:opacity-100 hover:bg-line", focusRing)}><Eye className="size-3" aria-hidden/>View</Link> : null}
        </span>
      </div>
    </li>);
}

/** The selected period in numbers. Open counts are where tasks stood at its end (today for this period). */
export function QuickStats({ model }: { model: TimelineModel }) {
    const s = model.stats[model.selected], p = model.periods[model.selected];
    const rows: { icon: LucideIcon; label: string; value: number; tone: string }[] = [
        { icon: CircleCheck, label: `Accepted this ${model.unit}`, value: s.accepted, tone: "text-success" },
        { icon: Clock3, label: "In progress", value: s.open.in_progress, tone: "text-info" },
        { icon: BadgeCheck, label: "In review", value: s.open.review, tone: "text-warning" },
        { icon: CircleDashed, label: "To do", value: s.open.to_do, tone: "text-ink-secondary" },
        { icon: TriangleAlert, label: "Overdue", value: s.overdue, tone: s.overdue ? "text-danger" : "text-ink-secondary" },
        { icon: Zap, label: "Activities", value: s.activities, tone: "text-ink" },
    ];
    return (<section aria-label="Quick stats" className="rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]">
      <h3 className="px-4 pt-3.5 pb-1 text-sm font-semibold text-ink">Quick stats</h3>
      <p className="px-4 pb-2 text-xs text-ink-tertiary">{p.upcoming ? "Not started yet" : p.current ? "So far, as of today" : `As of ${day(p.to)}`}</p>
      <dl>
        {rows.map((r) => (<div key={r.label} className="flex items-center gap-2.5 border-t border-line px-4 py-2.5 text-[13px]">
            <r.icon className={cn("size-4 shrink-0", r.tone)} aria-hidden/>
            <dt className="flex-1 text-ink-secondary">{r.label}</dt>
            <dd className={cn("font-semibold tabular", r.tone)}>{r.value}</dd>
          </div>))}
      </dl>
    </section>);
}

function FilterSelect({ label, value, onChange, children }: { label: string; value: string; onChange: (v: string) => void; children: React.ReactNode }) {
    return (<label className={cn("relative flex h-9 min-w-0 items-center rounded-xl bg-surface pl-3 shadow-[0_0_0_1px_var(--line)] focus-within:shadow-[0_0_0_2px_var(--copper)]", value && "shadow-[0_0_0_1.5px_var(--copper),0_0_0_4px_var(--copper-soft)]")}>
      <span className="shrink-0 text-[12.5px] text-ink-tertiary">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="h-full min-w-0 flex-1 cursor-pointer appearance-none truncate bg-transparent pr-8 pl-2 text-[13px] font-semibold text-ink outline-none">{children}</select>
      <ChevronDown className="pointer-events-none absolute right-2.5 size-3.5 text-ink-tertiary" aria-hidden/>
    </label>);
}

/** Type and person. Folds away on small screens. */
export function ActivityFilters({ model }: { model: TimelineModel }) {
    const [open, setOpen] = React.useState(false);
    const f = model.filters, set = (patch: Partial<Filters>) => model.setFilters({ ...f, ...patch }), n = filterCount(f);
    // Who appears in this project's log, for the person filter.
    const people = [...new Set(model.byPeriod.flat().map((e) => e.user_id).filter((id): id is string => !!id))]
        .map((id) => ({ id, ...model.people[id] })).filter((p) => p.name).sort((a, b) => a.name.localeCompare(b.name));
    return (<section aria-label="Activity filters" className="rounded-2xl bg-surface shadow-[0_0_0_1px_var(--line)]">
      <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className={cn("flex w-full items-center gap-2 px-4 py-3.5 text-left lg:pointer-events-none", focusRing)}>
        <SlidersHorizontal className="size-4 text-ink-tertiary" aria-hidden/>
        <span className="flex-1 text-sm font-semibold text-ink">Activity filters{n ? <span className="ml-1.5 rounded-full bg-copper px-1.5 text-[11px] leading-[18px] font-semibold text-white tabular">{n}</span> : null}</span>
        <ChevronDown className={cn("size-4 text-ink-tertiary transition-transform lg:hidden", open && "rotate-180")} aria-hidden/>
      </button>
      <div className={cn("grid gap-2 px-4 pb-4", !open && "max-lg:hidden")}>
        <FilterSelect label="Type" value={f.kind} onChange={(v) => set({ kind: v as Filters["kind"] })}>
          <option value="">All</option>{LOG_KINDS.map((k) => <option key={k.kind} value={k.kind}>{k.label}</option>)}
        </FilterSelect>
        <FilterSelect label="Person" value={f.person} onChange={(v) => set({ person: v })}>
          <option value="">Everyone</option>{people.map((p) => <option key={p.id} value={p.id}>{p.name} · {p.role}</option>)}
        </FilterSelect>
        {n ? <button type="button" onClick={() => model.setFilters(NO_FILTERS)} className={cn("justify-self-start rounded-full px-1 text-[13px] font-semibold text-brand hover:underline", focusRing)}>Clear filters</button> : null}
      </div>
    </section>);
}
