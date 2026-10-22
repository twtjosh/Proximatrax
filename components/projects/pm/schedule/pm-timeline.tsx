"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Lock, Plus, UserRound } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing, primaryAction } from "@/components/dashboard/overview-kit";
import { normalizeBoardStage, taskBlockedReason, type BoardColumnStage } from "@/lib/board-workflow";
import { projectPath } from "@/lib/constants";
import { addDays, daysBetween, formatDate, plural } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { milestoneSpans, monthTicks, shiftLabel, timelineRange } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { updateMilestone } from "@/services/project-service";
import { updateTask, type TaskWithRelations } from "@/services/task-service";
import type { Milestone, Profile, TaskAttachment } from "@/types/database";
import { AssignMenu, assignTask } from "../assign-menu";
import { isLate } from "../board/board-meta";
import { TaskSheet } from "../board/task-sheet";
import { setQuery, useTaskActions } from "../board/use-task-actions";
import { AddMilestone } from "./add-milestone";
import { MilestonePanel } from "./milestone-panel";

type Zoom = "week" | "month";
/** Pixels per day at each zoom. */
const PX: Record<Zoom, number> = { week: 34, month: 11 };
const ROW_H = 44;
const BAR: Record<BoardColumnStage, string> = {
    to_do: "bg-stage-todo text-ink",
    in_progress: "bg-stage-progress text-white",
    review: "bg-stage-review text-ink",
    done: "bg-stage-done text-white",
};
/** Open work no one has been given: it stays off the timeline until someone has it. */
const needsOwner = (t: TaskWithRelations) => !t.assigned_to && t.stage !== "done";
/** A dated task with an owner (or already accepted) is drawn on the timeline. */
const onTimeline = (t: TaskWithRelations) => !!t.due_date && !needsOwner(t);
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const weekday = (iso: string) => new Date(`${iso}T00:00:00Z`).getUTCDay();

type Drag = { kind: "task" | "milestone"; id: string; mode: "move" | "start" | "end"; x0: number; start: string | null; due: string; delta: number };

/**
 * The PM's Gantt: every milestone as a group with its tasks beneath, drawn
 * from start to due. Drag a bar to move it, an end to stretch it, a diamond
 * to move a milestone; it snaps to days and can be undone. Click opens the task.
 */
export function PmTimeline({ projectId, start, end, milestones, tasks, attachments, comments, people, today, viewerId, closed }: {
    projectId: string;
    start: string;
    end: string;
    milestones: Milestone[];
    tasks: TaskWithRelations[];
    attachments: TaskAttachment[];
    comments: Record<string, number>;
    people: Profile[];
    today: string;
    viewerId: string;
    closed: boolean;
}) {
    const router = useRouter();
    const params = useSearchParams();
    const reduce = useReducedMotion();
    const [ms, setMs] = React.useState(milestones);
    const [seenMs, setSeenMs] = React.useState(milestones);
    if (seenMs !== milestones) {
        setSeenMs(milestones);
        setMs(milestones);
    }
    const actions = useTaskActions({ projectId, viewerId, closed, milestones: ms, tasks, attachments, comments });
    const { items, patchTask, gate, show } = actions;
    // Opens on months, the whole project at a glance; days is the close-up.
    const zoom: Zoom = params.get("zoom") === "days" ? "week" : "month";
    const px = PX[zoom];
    // Every group starts folded to its milestone line; open the ones you're working in.
    const [expanded, setExpanded] = React.useState<Set<string>>(() => new Set());
    const [drag, setDrag] = React.useState<Drag | null>(null);
    const [adding, setAdding] = React.useState(false);
    const scroller = React.useRef<HTMLDivElement>(null);
    const moved = React.useRef(false);
    const openMilestone = params.get("milestone");

    // Live dates: what a drag in progress would make them.
    const shifted = (d: Drag, which: "start" | "due") => {
        if (which === "due")
            return d.mode === "start" ? d.due : addDays(d.due, d.delta);
        if (!d.start)
            return null;
        return d.mode === "end" ? d.start : addDays(d.start, d.delta);
    };
    const taskDates = (t: TaskWithRelations) => (drag?.kind === "task" && drag.id === t.id ? { start: shifted(drag, "start"), due: shifted(drag, "due") } : { start: t.start_date, due: t.due_date });
    const msDue = (m: Milestone) => (drag?.kind === "milestone" && drag.id === m.id ? addDays(drag.due, drag.delta) : m.due_date);

    const sorted = [...ms].sort((a, b) => a.due_date.localeCompare(b.due_date));
    const scheduled = items.filter(onTimeline);
    const range = React.useMemo(() => timelineRange(start, end, [...ms, ...scheduled.map((t) => ({ due_date: t.due_date! })), ...scheduled.filter((t) => t.start_date).map((t) => ({ due_date: t.start_date! }))]),
    // The window holds still while dragging so the bar doesn't run from the pointer.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [start, end, drag ? null : ms, drag ? null : items]);
    const days = daysBetween(range.from, range.to) + 1;
    const width = days * px;
    const x = (iso: string) => daysBetween(range.from, iso) * px;
    const spans = new Map(milestoneSpans(ms.map((m) => ({ ...m, due_date: msDue(m) })), start).map((s) => [s.id, s]));
    const todayX = today >= range.from && today <= range.to ? x(today) + px / 2 : null;

    // Open on today.
    React.useEffect(() => {
        if (todayX !== null && scroller.current)
            scroller.current.scrollLeft = Math.max(todayX - scroller.current.clientWidth / 3, 0);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [zoom]);

    type Row = { type: "group"; id: string; label: string; milestone?: Milestone; count: number; done: number } | { type: "task"; task: TaskWithRelations };
    const rows: Row[] = [];
    const groupOf = (id: string, label: string, list: TaskWithRelations[], milestone?: Milestone) => {
        // The group counts all its dated work; only tasks with an owner get a bar.
        const shown = list.filter(onTimeline);
        rows.push({ type: "group", id, label, milestone, count: list.length, done: list.filter((t) => t.stage === "done").length });
        if (expanded.has(id))
            shown.sort((a, b) => (a.start_date ?? a.due_date ?? "9999").localeCompare(b.start_date ?? b.due_date ?? "9999")).forEach((task) => rows.push({ type: "task", task }));
    };
    sorted.forEach((m) => groupOf(m.id, m.title, items.filter((t) => t.milestone_id === m.id && t.due_date), m));
    const loose = items.filter((t) => !t.milestone_id && onTimeline(t));
    if (loose.length)
        groupOf("loose", "No milestone", loose);
    const unscheduled = items.filter((t) => !t.due_date && t.stage !== "done" && t.assigned_to);
    const unowned = items.filter(needsOwner);

    /** Gives a task to someone (or no one) from its row: shown at once, put back if the save fails. */
    async function assign(t: TaskWithRelations, p: Profile | null) {
        const before = { assigned_to: t.assigned_to, assignee: t.assignee };
        patchTask(t.id, { assigned_to: p?.id ?? null, assignee: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null });
        try {
            await assignTask(projectId, t, p);
            router.refresh();
        }
        catch (e) {
            patchTask(t.id, before);
            toast.error(e instanceof Error ? e.message : "That change didn't save.");
        }
    }

    async function saveTask(t: TaskWithRelations, next: { start: string | null; due: string }, undoable = true) {
        const before = { start_date: t.start_date, due_date: t.due_date };
        patchTask(t.id, { start_date: next.start, due_date: next.due });
        try {
            await updateTask({ id: t.id, start_date: next.start, due_date: next.due });
            if (undoable)
                toast.success(`"${t.title}" ${next.start ? `runs ${short(next.start)} – ${short(next.due)}` : `is due ${short(next.due)}`}`, { action: { label: "Undo", onClick: () => void saveTask({ ...t, start_date: next.start, due_date: next.due }, { start: before.start_date, due: before.due_date! }, false) } });
            router.refresh();
        }
        catch (e) {
            patchTask(t.id, before);
            toast.error(e instanceof Error ? e.message : "That date didn't save.");
        }
    }
    async function saveMilestone(m: Milestone, to: string, undoable = true) {
        const from = m.due_date;
        setMs((list) => list.map((x) => (x.id === m.id ? { ...x, due_date: to } : x)));
        try {
            await updateMilestone({ id: m.id, due_date: to });
            void logActivity({ project_id: projectId, action_type: "milestone_rescheduled", details: { milestone_id: m.id, title: m.title, due_date: to } });
            if (undoable)
                toast.success(`${m.title} is due ${short(to)}`, { action: { label: "Undo", onClick: () => void saveMilestone({ ...m, due_date: to }, from, false) } });
            router.refresh();
        }
        catch (e) {
            setMs((list) => list.map((x) => (x.id === m.id ? { ...x, due_date: from } : x)));
            toast.error(e instanceof Error ? e.message : "That date didn't save.");
        }
    }

    function begin(e: React.PointerEvent, d: Omit<Drag, "x0" | "delta">) {
        if (closed || e.button !== 0)
            return;
        e.stopPropagation();
        e.currentTarget.setPointerCapture(e.pointerId);
        moved.current = false;
        setDrag({ ...d, x0: e.clientX, delta: 0 });
    }
    function onMove(e: React.PointerEvent) {
        if (!drag)
            return;
        let delta = Math.round((e.clientX - drag.x0) / px);
        // A task never ends before it starts.
        if (drag.kind === "task" && drag.start) {
            const span = daysBetween(drag.start, drag.due);
            if (drag.mode === "start")
                delta = Math.min(delta, span);
            if (drag.mode === "end")
                delta = Math.max(delta, -span);
        }
        if (delta !== drag.delta) {
            moved.current = true;
            setDrag({ ...drag, delta });
        }
    }
    function finish() {
        if (!drag)
            return;
        const d = drag;
        setDrag(null);
        if (!d.delta)
            return;
        if (d.kind === "milestone") {
            const m = ms.find((x) => x.id === d.id);
            if (m)
                void saveMilestone(m, addDays(d.due, d.delta));
            return;
        }
        const t = items.find((x) => x.id === d.id);
        if (t)
            void saveTask(t, { start: shifted(d, "start"), due: shifted(d, "due")! });
    }
    /** Arrows move a bar a day, Shift a week; Alt stretches its end. */
    function onBarKey(e: React.KeyboardEvent, t: TaskWithRelations) {
        if (e.key === "Enter") {
            show(t);
            return;
        }
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step || closed || !t.due_date || t.stage === "done")
            return;
        e.preventDefault();
        const by = step * (e.shiftKey ? 7 : 1);
        const due = addDays(t.due_date, by);
        if (e.altKey)
            void saveTask(t, { start: t.start_date && t.start_date > due ? due : t.start_date, due });
        else
            void saveTask(t, { start: t.start_date ? addDays(t.start_date, by) : null, due });
    }

    const openMs = openMilestone ? ms.find((m) => m.id === openMilestone) ?? null : null;
    const counts = new Map<string, { total: number; accepted: number }>();
    for (const t of items) {
        if (!t.milestone_id)
            continue;
        const c = counts.get(t.milestone_id) ?? { total: 0, accepted: 0 };
        c.total += 1;
        if (t.stage === "done")
            c.accepted += 1;
        counts.set(t.milestone_id, c);
    }

    return (<div className="grid gap-4 pt-2">
      <div className="flex flex-wrap items-center gap-3">
        <p className="text-sm text-ink-secondary">
          <b className="font-semibold text-ink">{plural(ms.length, "milestone")}</b> · {plural(scheduled.length, "task")} on the timeline
          {unowned.length ? (<>{" · "}<Link href={`${projectPath(projectId)}#no-owner`} className={cn("rounded-sm font-medium text-warning underline-offset-4 hover:underline", focusRing)}>{unowned.length} not assigned</Link></>) : null}
          {" · "}handover {short(end)}
        </p>
        <span className="text-xs text-ink-tertiary max-lg:hidden">Drag a bar to move it, its ends to change start or due</span>
        <div className="ml-auto flex items-center gap-2">
          <div role="radiogroup" aria-label="Zoom" className="flex rounded-full bg-surface-sunken p-1">
            {(["week", "month"] as const).map((z) => (<button key={z} type="button" role="radio" aria-checked={zoom === z} onClick={() => setQuery({ zoom: z === "week" ? "days" : null })} className={cn("relative isolate h-7 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors duration-300", zoom === z ? "text-ink" : "text-ink-secondary hover:text-ink", focusRing)}>
                {zoom === z ? <motion.span layoutId="timeline-zoom" transition={SPRING} className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card"/> : null}
                {z === "week" ? "Days" : "Months"}
              </button>))}
          </div>
          {todayX !== null ? <button type="button" onClick={() => scroller.current?.scrollTo({ left: Math.max(todayX - scroller.current.clientWidth / 3, 0), behavior: reduce ? "auto" : "smooth" })} className={cn("press h-9 cursor-pointer rounded-full bg-surface-sunken px-3.5 text-xs font-medium hover:bg-line", focusRing)}>Today</button> : null}
          {!closed ? <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className={cn(primaryAction, "h-9 px-4")}><Plus aria-hidden/>Milestone</button> : null}
        </div>
      </div>

      <AnimatePresence initial={false}>
        {adding ? <AddMilestone key="add" projectId={projectId} existing={ms} start={start} end={end} reduce={!!reduce} onDone={(m) => {
                setAdding(false);
                if (m) {
                    setMs((list) => [...list, m]);
                    router.refresh();
                }
            }}/> : null}
      </AnimatePresence>

      <section aria-label="Timeline" className="materialize overflow-hidden rounded-[22px] material">
        <div ref={scroller} className="relative max-h-[calc(100dvh-16rem)] min-h-64 overflow-auto overscroll-x-contain" onPointerMove={onMove} onPointerUp={finish} onPointerCancel={finish}>
          <div className="relative [--label-w:10rem] sm:[--label-w:17rem]" style={{ width: `calc(var(--label-w) + ${width}px)` }}>
            {/* Grid: day lines, weekends, the project window, today. */}
            <div aria-hidden className="pointer-events-none absolute inset-y-0" style={{ left: "var(--label-w)", width }}>
              <span className="absolute inset-y-0 bg-brand/[0.035]" style={{ left: x(start), width: x(end) - x(start) + px }}/>
              {zoom === "week" ? Array.from({ length: days }, (_, i) => addDays(range.from, i)).filter((d) => weekday(d) === 0 || weekday(d) === 6).map((d) => <span key={d} className="absolute inset-y-0 bg-surface-sunken/70" style={{ left: x(d), width: px }}/>) : null}
              <span className="absolute inset-0" style={{ backgroundImage: `repeating-linear-gradient(to right, transparent 0 ${px * (zoom === "week" ? 1 : 7) - 1}px, var(--line) ${px * (zoom === "week" ? 1 : 7) - 1}px ${px * (zoom === "week" ? 1 : 7)}px)`, backgroundPositionX: zoom === "week" ? 0 : `${((8 - weekday(range.from)) % 7) * px}px`, opacity: 0.6 }}/>
              {todayX !== null ? <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 bg-brand" style={{ left: todayX }}/> : null}
            </div>

            {/* Header */}
            <div className="sticky top-0 z-20 flex h-12 border-b border-line bg-surface/95 backdrop-blur-xl">
              <div className="sticky left-0 z-10 flex shrink-0 items-end border-r border-line bg-surface/95 px-4 pb-2 text-xs font-medium text-ink-tertiary" style={{ width: "var(--label-w)" }}>Work</div>
              <div className="relative" style={{ width }}>
                <span className="absolute top-1.5 left-2 text-xs font-semibold text-ink">{formatDate(range.from, { month: "long" })}</span>
                {monthTicks(range).map((t) => <span key={t.date} className="absolute top-1.5 border-l border-line-strong pl-2 text-xs font-semibold text-ink" style={{ left: x(t.date) }}>{formatDate(t.date, { month: "long" })}</span>)}
                <div className="absolute inset-x-0 bottom-1 h-4 text-[10px] text-ink-tertiary tabular">
                  {Array.from({ length: days }, (_, i) => addDays(range.from, i)).filter((d) => zoom === "week" || weekday(d) === 1).map((d) => (<span key={d} className={cn("absolute text-center", d === today && "font-bold text-brand")} style={{ left: x(d), width: px }}>{Number(d.slice(8))}</span>))}
                </div>
                {todayX !== null ? <span className="absolute top-1 -translate-x-1/2 rounded-full bg-brand px-1.5 py-px text-[10px] font-semibold text-white" style={{ left: todayX }}>Today</span> : null}
              </div>
            </div>

            <ol>
              {rows.map((r) => r.type === "group" ? (<li key={`g-${r.id}`} className="relative flex border-b border-line bg-surface-subtle/80" style={{ height: ROW_H }}>
                    <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1 border-r border-line bg-surface-subtle px-2" style={{ width: "var(--label-w)" }}>
                      <button type="button" onClick={() => setExpanded((c) => {
                        const n = new Set(c);
                        if (n.has(r.id))
                            n.delete(r.id);
                        else
                            n.add(r.id);
                        return n;
                    })} aria-expanded={expanded.has(r.id)} aria-label={`${expanded.has(r.id) ? "Hide" : "Show"} ${r.label}`} className={cn("grid size-7 shrink-0 cursor-pointer place-items-center rounded-lg text-ink-tertiary hover:bg-surface-sunken", focusRing)}>
                        <ChevronRight className={cn("size-4 transition-transform duration-300 ease-spring", expanded.has(r.id) && "rotate-90")} aria-hidden/>
                      </button>
                      <button type="button" disabled={!r.milestone} onClick={() => r.milestone && setQuery({ milestone: r.milestone.id })} className={cn("min-w-0 flex-1 cursor-pointer rounded-lg px-1.5 py-1 text-left hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent", focusRing)}>
                        <span className="block truncate text-[13px] font-semibold text-ink">{r.label}</span>
                        <span className="block truncate text-[11px] text-ink-tertiary tabular">{r.count ? `${r.done} of ${plural(r.count, "task")} accepted` : "No dated tasks"}{r.milestone ? ` · due ${short(msDue(r.milestone))}` : ""}</span>
                      </button>
                    </div>
                    {r.milestone ? (() => {
                    const m = r.milestone;
                    const span = spans.get(m.id)!;
                    const late = !m.completed && msDue(m) < today;
                    const share = m.completed ? 1 : r.count ? r.done / r.count : 0;
                    const dragging = drag?.kind === "milestone" && drag.id === m.id;
                    return (<div className="relative" style={{ width }}>
                        <span className="absolute top-1/2 h-2 -translate-y-1/2 overflow-hidden rounded-full bg-copper/20" style={{ left: x(span.start), width: Math.max(x(span.end) - x(span.start) + px, px) }}>
                          <motion.span className={cn("absolute inset-y-0 left-0 rounded-full", m.completed ? "bg-stage-done" : "bg-copper")} initial={reduce ? false : { width: 0 }} animate={{ width: `${share * 100}%` }} transition={SPRING}/>
                        </span>
                        <button type="button" aria-label={`${m.title}, due ${short(msDue(m))}. Drag to move.`} disabled={closed || m.completed} onPointerDown={(e) => begin(e, { kind: "milestone", id: m.id, mode: "move", start: null, due: m.due_date })} onClick={() => !moved.current && setQuery({ milestone: m.id })} className={cn("absolute top-1/2 grid size-6 -translate-x-1/2 -translate-y-1/2 place-items-center touch-none", !closed && !m.completed && "cursor-ew-resize", focusRing)} style={{ left: x(msDue(m)) + px / 2 }}>
                          <span className={cn("size-3.5 rotate-45 rounded-[3px] ring-[3px] ring-surface shadow-[0_1px_4px_rgb(14_18_34/0.3)] transition-transform duration-200", m.completed ? "bg-stage-done" : late ? "bg-stage-late" : "bg-copper", dragging && "scale-125")}/>
                        </button>
                        {dragging && drag.delta ? <DragLabel x={x(msDue(m)) + px} text={short(msDue(m))} shift={shiftLabel(m.due_date, msDue(m))}/> : null}
                      </div>);
                })() : <div style={{ width }}/>}
                  </li>) : (() => {
                const t = r.task;
                const stage = normalizeBoardStage(t.stage);
                const { start: s, due } = taskDates(t);
                const left = x(s ?? due!);
                const barW = x(due!) - left + px;
                const dragging = drag?.kind === "task" && drag.id === t.id;
                const late = isLate(t, today);
                const blocked = stage === "to_do" ? taskBlockedReason(t, "project_manager", gate) : null;
                const movable = !closed && stage !== "done";
                const inside = barW > 110;
                const owner =t.assignee ? <Face person={{ id: t.assignee.id, name: t.assignee.full_name, avatarUrl: t.assignee.avatar_url, role: "" }} size={22}/> : (<span className="grid size-5.5 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-tertiary"><UserRound className="size-3" aria-hidden/></span>);
                return (<li key={t.id} className="group relative flex border-b border-line/70 last:border-b-0" style={{ height: ROW_H }}>
                      <div className="sticky left-0 z-10 flex shrink-0 items-center gap-1.5 border-r border-line bg-surface py-1 pr-2 pl-4 sm:pl-10 group-hover:bg-surface-subtle" style={{ width: "var(--label-w)" }}>
                        <button type="button" onClick={() => show(t)} className={cn("min-w-0 flex-1 cursor-pointer truncate rounded-md py-1 text-left text-[13px] text-ink", focusRing)}>{t.title}</button>
                        {/* Choosing No one takes the task off the timeline, onto the Overview's No one assigned card. */}
                        {movable ? (<AssignMenu task={t} owner={t.assignee?.full_name ?? null} people={people} onAssign={(p) => void assign(t, p)} className="grid shrink-0 cursor-pointer place-items-center rounded-full p-0.5 hover:bg-surface-sunken data-popup-open:bg-surface-sunken">
                            {owner}
                          </AssignMenu>) : <span className="p-0.5" title={t.assignee?.full_name ?? "No one"}>{owner}</span>}
                      </div>
                      <div className="relative" style={{ width }}>
                        <div role="slider" tabIndex={movable ? 0 : -1} aria-label={`${t.title}: ${s ? `${short(s)} to ` : "due "}${short(due!)}${t.assignee ? `, ${t.assignee.full_name}` : ""}`} aria-valuetext={s ? `${short(s)} to ${short(due!)}` : `Due ${short(due!)}`} aria-valuenow={daysBetween(range.from, due!)} aria-valuemin={0} aria-valuemax={days} onKeyDown={(e) => onBarKey(e, t)} onPointerDown={(e) => movable && begin(e, { kind: "task", id: t.id, mode: "move", start: t.start_date, due: t.due_date! })} onClick={() => !moved.current && show(t)} className={cn("absolute top-1/2 flex h-7 -translate-y-1/2 items-center gap-1 overflow-hidden rounded-lg px-2 text-[11px] font-semibold shadow-[0_1px_2px_rgb(14_18_34/0.12)] transition-[box-shadow,filter] duration-200 touch-none", BAR[stage], movable ? "cursor-grab active:cursor-grabbing" : "cursor-pointer", late && "ring-2 ring-stage-late ring-offset-1 ring-offset-surface", !s && "[mask-image:linear-gradient(to_right,transparent,black_10px)]", dragging && "z-10 shadow-[0_10px_24px_-8px_rgb(14_18_34/0.45)] brightness-105", focusRing)} style={{ left, width: barW }}>
                          {blocked && blocked !== "Needs owner" ? <Lock className="size-3 shrink-0 opacity-70" aria-hidden/> : null}
                          {inside ? <span className="truncate">{t.title}</span> : null}
                          {movable ? (<>
                              <span onPointerDown={(e) => begin(e, { kind: "task", id: t.id, mode: "start", start: t.start_date ?? t.due_date!, due: t.due_date! })} aria-hidden className="absolute inset-y-0 left-0 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 after:absolute after:inset-y-1.5 after:left-0.5 after:w-0.5 after:rounded-full after:bg-current/50"/>
                              <span onPointerDown={(e) => begin(e, { kind: "task", id: t.id, mode: "end", start: t.start_date, due: t.due_date! })} aria-hidden className="absolute inset-y-0 right-0 w-2 cursor-ew-resize opacity-0 transition-opacity group-hover:opacity-100 after:absolute after:inset-y-1.5 after:right-0.5 after:w-0.5 after:rounded-full after:bg-current/50"/>
                            </>) : null}
                        </div>
                        {!inside && !dragging ? <span className="pointer-events-none absolute top-1/2 -translate-y-1/2 truncate text-[11px] font-medium text-ink-secondary" style={{ left: left + barW + 8, maxWidth: 220 }}>{t.title}</span> : null}
                        {dragging && drag.delta ? <DragLabel x={left + barW} text={s ? `${short(s)} – ${short(due!)}` : short(due!)} shift={shiftLabel(t.due_date!, due!) || (s && t.start_date ? shiftLabel(t.start_date, s) : "")}/> : null}
                      </div>
                    </li>);
            })())}
            </ol>
            {rows.length === 0 ? <p className="sticky left-0 px-6 py-10 text-sm text-ink-tertiary" style={{ width: "min(100%, 40rem)" }}>{unowned.length ? "Nothing on the timeline yet. Assign its tasks from the Overview to put them here." :"Nothing on the timeline yet. Add a milestone, then give tasks a due date."}</p> : null}
          </div>
        </div>
      </section>

      {unscheduled.length > 0 ? (<section aria-label="Not scheduled" className="materialize rounded-[22px] material p-4 sm:p-5">
          <h2 className="text-sm font-semibold">Not scheduled <span className="font-normal text-ink-tertiary tabular">{unscheduled.length}</span></h2>
          <p className="mt-0.5 text-xs text-ink-tertiary">Give these a due date to put them on the timeline.</p>
          <ul className="mt-3 flex flex-wrap gap-2">
            {unscheduled.map((t) => (<li key={t.id} className="flex items-center gap-1.5 rounded-full bg-surface-sunken py-1 pr-1 pl-3 text-xs">
                <button type="button" onClick={() => show(t)} className={cn("max-w-56 cursor-pointer truncate font-medium text-ink hover:underline", focusRing)}>{t.title}</button>
                {!closed ? (<label className="relative inline-flex h-7 cursor-pointer items-center rounded-full bg-surface px-2.5 font-medium text-ink-secondary hover:text-ink">
                    Set date
                    <input type="date" aria-label={`Due date for ${t.title}`} onChange={(e) => e.target.value && void saveTask(t, { start: t.start_date, due: e.target.value })} className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full"/>
                  </label>) : null}
              </li>))}
          </ul>
        </section>) : null}

      <TaskSheet {...actions.sheet} people={people} projectStart={start} today={today} reduce={!!reduce}/>
      <MilestonePanel milestone={openMs} projectId={projectId} tasks={items} people={people} milestones={ms} projectStart={start} today={today} closed={closed} count={openMs ? counts.get(openMs.id) ?? { total: 0, accepted: 0 } : { total: 0, accepted: 0 }} onClose={() => setQuery({ milestone: null })} onPatch={(id, p) => setMs((list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)))} onReschedule={(m, to) => void saveMilestone(m, to)} onDeleted={(id) => {
            setQuery({ milestone: null });
            setMs((list) => list.filter((m) => m.id !== id));
            router.refresh();
        }}/>
    </div>);
}

function DragLabel({ x, text, shift }: {
    x: number;
    text: string;
    shift: string;
}) {
    return (<span className="pointer-events-none absolute -top-1 z-20 rounded-md bg-ink px-1.5 py-0.5 text-[11px] font-semibold whitespace-nowrap text-white tabular shadow-lg" style={{ left: x + 6 }}>
      {text}{shift ? <span className={cn("ml-1", shift.startsWith("+") ? "text-[#ffb4a8]" : "text-[#9ee6c5]")}>{shift}</span> : null}
    </span>);
}
