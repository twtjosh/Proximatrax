"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, Plus } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { addDays, daysBetween, formatDate, plural } from "@/lib/dashboard";
import { MILESTONE_SUGGESTIONS } from "@/lib/milestone-utils";
import { SPRING } from "@/lib/motion";
import { dateToFraction, fractionToDate, milestoneSpans, monthTicks, shiftLabel, timelineRange, type Range } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { createMilestone, updateMilestone } from "@/services/project-service";
import type { TaskWithRelations } from "@/services/task-service";
import type { Milestone, Profile } from "@/types/database";
import { MilestonePanel } from "./milestone-panel";

type State = "delivered" | "late" | "current" | "upcoming";
const BAR: Record<State, { bar: string; fill: string; label: string; chip: string }> = {
    delivered: { bar: "bg-stage-done/25", fill: "bg-stage-done", label: "Delivered", chip: "bg-success-soft text-success" },
    late: { bar: "bg-stage-late/20", fill: "bg-stage-late", label: "Late", chip: "bg-danger-soft text-danger" },
    current: { bar: "bg-brand/20", fill: "bg-brand", label: "Now", chip: "bg-brand-soft text-brand-hover" },
    upcoming: { bar: "bg-stage-todo/45", fill: "bg-ink-tertiary/60", label: "Upcoming", chip: "bg-surface-sunken text-ink-secondary" },
};
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const pct = (f: number) => `${(f * 100).toFixed(3)}%`;

type Drag = { id: string; original: string; date: string; range: Range; left: number; width: number };

/**
 * The PM's schedule: every milestone as a bar on one timeline, from the one
 * before it to its due date. Drag a bar's end (or use the arrow keys on it)
 * to move a date; it snaps to days and can be undone. A milestone opens a
 * panel with its tasks.
 */
export function PmSchedule({ projectId, start, end, milestones, tasks, people, today, closed }: {
    projectId: string;
    start: string;
    end: string;
    milestones: Milestone[];
    tasks: TaskWithRelations[];
    people: Profile[];
    today: string;
    closed: boolean;
}) {
    const router = useRouter();
    const params = useSearchParams();
    const reduce = useReducedMotion();
    const [items, setItems] = React.useState(milestones);
    const [seen, setSeen] = React.useState(milestones);
    if (seen !== milestones) {
        setSeen(milestones);
        setItems(milestones);
    }
    const [drag, setDrag] = React.useState<Drag | null>(null);
    const [adding, setAdding] = React.useState(false);
    const keyTimer = React.useRef<number | undefined>(undefined);
    const openId = params.get("milestone");

    const live = items.map((m) => (drag?.id === m.id ? { ...m, due_date: drag.date } : m));
    const sorted = [...live].sort((a, b) => a.due_date.localeCompare(b.due_date));
    // The window holds still while a date is dragged, so the bar doesn't run from the pointer.
    const range = drag?.range ?? timelineRange(start, end, live);
    const spans = new Map(milestoneSpans(live, start).map((s) => [s.id, s]));
    const ticks = monthTicks(range);
    const todayAt = dateToFraction(today, range);
    const counts = new Map<string, { total: number; accepted: number }>();
    for (const t of tasks) {
        if (!t.milestone_id)
            continue;
        const c = counts.get(t.milestone_id) ?? { total: 0, accepted: 0 };
        c.total += 1;
        if (t.stage === "done")
            c.accepted += 1;
        counts.set(t.milestone_id, c);
    }
    // "Now" is the open milestone whose stretch today falls in.
    const state = (m: Milestone): State => (m.completed ? "delivered" : m.due_date < today ? "late" : (spans.get(m.id)?.start ?? today) <= today ? "current" : "upcoming");

    const setOpen = (id: string | null) => {
        const next = new URLSearchParams(window.location.search);
        if (id)
            next.set("milestone", id);
        else
            next.delete("milestone");
        const qs = next.toString();
        window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    };
    const patch = (id: string, p: Partial<Milestone>) => setItems((list) => list.map((m) => (m.id === id ? { ...m, ...p } : m)));

    async function reschedule(m: Milestone, from: string, to: string, undoable = true) {
        if (from === to)
            return;
        patch(m.id, { due_date: to });
        try {
            await updateMilestone({ id: m.id, due_date: to });
            void logActivity({ project_id: projectId, action_type: "milestone_rescheduled", details: { milestone_id: m.id, title: m.title, due_date: to } });
            if (undoable)
                toast.success(`${m.title} is due ${short(to)}`, { description: `${plural(Math.abs(daysBetween(from, to)), "day")} ${to > from ? "later" : "earlier"}`, action: { label: "Undo", onClick: () => void reschedule(m, to, from, false) } });
            router.refresh();
        }
        catch (e) {
            patch(m.id, { due_date: from });
            toast.error(e instanceof Error ? e.message : "That date didn't save.");
        }
    }

    function startDrag(e: React.PointerEvent<HTMLElement>, m: Milestone) {
        if (closed || m.completed)
            return;
        const track = e.currentTarget.closest<HTMLElement>("[data-track]");
        if (!track)
            return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        const rect = track.getBoundingClientRect();
        setDrag({ id: m.id, original: m.due_date, date: m.due_date, range, left: rect.left, width: rect.width });
    }
    function moveDrag(e: React.PointerEvent) {
        if (drag)
            setDrag({ ...drag, date: fractionToDate((e.clientX - drag.left) / drag.width, drag.range) });
    }
    function endDrag() {
        if (!drag)
            return;
        const m = items.find((x) => x.id === drag.id);
        setDrag(null);
        if (m)
            void reschedule(m, drag.original, drag.date);
    }
    /** Arrow keys move a day (Shift: a week); the date saves once the keys stop. */
    function onHandleKey(e: React.KeyboardEvent, m: Milestone) {
        const step = e.key === "ArrowRight" ? 1 : e.key === "ArrowLeft" ? -1 : 0;
        if (!step || closed || m.completed)
            return;
        e.preventDefault();
        const original = drag?.id === m.id ? drag.original : m.due_date;
        const date = addDays(drag?.id === m.id ? drag.date : m.due_date, step * (e.shiftKey ? 7 : 1));
        setDrag({ id: m.id, original, date, range, left: 0, width: 0 });
        window.clearTimeout(keyTimer.current);
        keyTimer.current = window.setTimeout(() => {
            setDrag(null);
            void reschedule(m, original, date);
        }, 700);
    }

    const open = openId ? items.find((m) => m.id === openId) ?? null : null;

    return (<div className="grid gap-4 pt-2">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <p className="text-sm text-ink-secondary">
          <b className="font-semibold text-ink">{plural(items.length, "milestone")}</b> · {short(start)} to handover {short(end)}
          {!closed && items.length > 0 ? <span className="text-ink-tertiary max-sm:hidden"> · drag a bar&apos;s end to move its date</span> : null}
        </p>
        {!closed ? <button type="button" onClick={() => setAdding((v) => !v)} aria-expanded={adding} className={cn(primaryAction, "h-9 px-4")}><Plus aria-hidden/>Add milestone</button> : null}
      </div>

      <AnimatePresence initial={false}>
        {adding ? <AddMilestone key="add" projectId={projectId} existing={items} start={start} end={end} reduce={!!reduce} onDone={(m) => {
                setAdding(false);
                if (m) {
                    setItems((list) => [...list, m]);
                    router.refresh();
                }
            }}/> : null}
      </AnimatePresence>

      {items.length === 0 ? (<div className="materialize grid justify-items-start gap-3 rounded-[24px] material p-6">
          <p className="text-[15px] font-semibold">No milestones yet</p>
          <p className="max-w-prose text-sm text-ink-secondary">Milestones are the checkpoints the client sees on their route. Add the first one, then give it tasks.</p>
        </div>) : (<section aria-label="Timeline" className="materialize overflow-hidden rounded-[24px] material" onPointerMove={moveDrag} onPointerUp={endDrag} onPointerCancel={endDrag}>
          <div className="relative grid">
            {/* The grid behind every row: months, the project window, today. */}
            <div aria-hidden className="pointer-events-none absolute inset-y-0 right-4 left-4 sm:right-6 sm:left-[14rem]">
              <span className="absolute inset-y-0 bg-surface-subtle" style={{ left: pct(dateToFraction(start, range)), width: pct(dateToFraction(end, range) - dateToFraction(start, range)) }}/>
              {ticks.map((t) => <span key={t.date} className="absolute inset-y-0 w-px bg-line" style={{ left: pct(t.fraction) }}/>)}
              {todayAt >= 0 && todayAt <= 1 ? <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-brand/35 sm:bg-brand/70" style={{ left: pct(todayAt) }}/> : null}
            </div>

            <div className="relative flex h-10 items-end border-b border-line px-4 pb-2 sm:pr-6 sm:pl-[14rem]">
              <div className="relative h-4 flex-1 text-[11px] font-medium text-ink-tertiary">
                {ticks.map((t) => <span key={t.date} className="absolute -translate-x-1/2 tabular" style={{ left: pct(t.fraction) }}>{t.label}</span>)}
                {todayAt >= 0 && todayAt <= 1 ? <span className="absolute -top-0.5 -translate-x-1/2 rounded-full bg-brand px-1.5 py-px text-[10px] font-semibold text-white" style={{ left: pct(todayAt) }}>Today</span> : null}
              </div>
            </div>

            <ol>
              {sorted.map((m, i) => {
                const s = state(m);
                const span = spans.get(m.id)!;
                const c = counts.get(m.id) ?? { total: 0, accepted: 0 };
                const from = dateToFraction(span.start, range);
                const to = dateToFraction(span.end, range);
                const dragging = drag?.id === m.id;
                const shift = dragging ? shiftLabel(drag.original, drag.date) : "";
                const movable = !closed && !m.completed;
                return (<motion.li key={m.id} layout={!reduce && !drag} transition={SPRING} className="group relative grid gap-2 border-b border-line px-4 py-3.5 last:border-b-0 sm:grid-cols-[14rem_minmax(0,1fr)] sm:items-center sm:gap-0 sm:pr-6 sm:pl-0">
                    <button type="button" onClick={() => setOpen(m.id)} className={cn("flex min-w-0 cursor-pointer items-center gap-2.5 rounded-xl text-left sm:mx-2 sm:px-2 sm:py-1.5 sm:hover:bg-surface-sunken", focusRing)}>
                      <span className="grid size-6 shrink-0 place-items-center rounded-full bg-surface-sunken text-[11px] font-semibold text-ink-secondary tabular">{m.completed ? <Check className="size-3.5 text-success" strokeWidth={3} aria-hidden/> : i + 1}</span>
                      <span className="min-w-0 flex-1">
                        <span className="block truncate text-sm font-semibold text-ink">{m.title}</span>
                        <span className="block text-xs text-ink-tertiary tabular">{c.total > 0 ? `${c.accepted} of ${plural(c.total, "task")} accepted` : "No tasks yet"}</span>
                      </span>
                      <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold sm:hidden", BAR[s].chip)}>{BAR[s].label}</span>
                    </button>
                    <div data-track className="relative h-9">
                      <span className={cn("absolute top-1/2 h-3 -translate-y-1/2 overflow-hidden rounded-full transition-colors duration-300", BAR[s].bar, dragging && "ring-2 ring-brand/40")} style={{ left: pct(from), width: `max(${pct(to - from)}, 0.75rem)` }}>
                        <motion.span className={cn("absolute inset-y-0 left-0 rounded-full", BAR[s].fill)} initial={reduce ? false : { width: 0 }} animate={{ width: pct(m.completed ? 1 : c.total ? c.accepted / c.total : 0) }} transition={{ ...SPRING, delay: reduce ? 0 : 0.15 + i * 0.05 }}/>
                      </span>
                      <span role={movable ? "slider" : undefined} tabIndex={movable ? 0 : -1} aria-label={`${m.title} due date`} aria-valuetext={`Due ${formatDate(live.find((x) => x.id === m.id)!.due_date, { weekday: "long", month: "long", day: "numeric" })}`} aria-valuemin={movable ? 0 : undefined} aria-valuemax={movable ? 1 : undefined} aria-valuenow={movable ? Number(to.toFixed(3)) : undefined} onPointerDown={(e) => startDrag(e, m)} onKeyDown={(e) => onHandleKey(e, m)} className={cn("absolute top-1/2 grid -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full transition-[transform,box-shadow] duration-200", movable ? "size-6 cursor-ew-resize touch-none hover:scale-110 active:scale-110" : "size-4", focusRing)} style={{ left: pct(to) }}>
                        <span className={cn("size-3.5 rounded-full ring-[3px] ring-surface shadow-[0_1px_4px_rgb(14_18_34/0.3)]", BAR[s].fill, dragging && "scale-125")}/>
                      </span>
                      <span className={cn("pointer-events-none absolute -top-1 whitespace-nowrap text-[11px] font-medium tabular transition-opacity duration-200", dragging ? "text-ink opacity-100" : "text-ink-tertiary opacity-0 group-hover:opacity-100 max-sm:opacity-100")} style={{ left: pct(to), transform: to > 0.85 ? "translateX(calc(-100% - 14px))" : "translateX(14px)" }}>
                        {short(dragging ? drag.date : m.due_date)}{shift ? <b className={cn("ml-1 font-semibold", shift.startsWith("+") ? "text-danger" : "text-success")}>{shift}</b> : null}
                      </span>
                    </div>
                  </motion.li>);
            })}
            </ol>
          </div>
        </section>)}

      <MilestonePanel milestone={open} projectId={projectId} tasks={tasks} people={people} milestones={items} today={today} closed={closed} count={open ? counts.get(open.id) ?? { total: 0, accepted: 0 } : { total: 0, accepted: 0 }} onClose={() => setOpen(null)} onPatch={patch} onReschedule={(m, to) => void reschedule(m, m.due_date, to)} onDeleted={(id) => {
            setOpen(null);
            setItems((list) => list.filter((m) => m.id !== id));
            router.refresh();
        }}/>
    </div>);
}

/** A name (or a common one) and a date; the date starts two weeks after the last milestone. */
function AddMilestone({ projectId, existing, start, end, reduce, onDone }: {
    projectId: string;
    existing: Milestone[];
    start: string;
    end: string;
    reduce: boolean;
    onDone: (m: Milestone | null) => void;
}) {
    const last = existing.map((m) => m.due_date).sort().at(-1) ?? start;
    const proposed = addDays(last, 14);
    const [title, setTitle] = React.useState("");
    const [date, setDate] = React.useState(proposed > end ? end : proposed);
    const [busy, setBusy] = React.useState(false);
    const taken = new Set(existing.map((m) => m.title.toLowerCase()));
    const suggestions = MILESTONE_SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !date || busy)
            return;
        setBusy(true);
        try {
            onDone(await createMilestone({ project_id: projectId, title: title.trim(), due_date: date }));
        }
        catch (err) {
            setBusy(false);
            toast.error(err instanceof Error ? err.message : "That milestone couldn't be added.");
        }
    }

    return (<motion.form initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onDone(null)} className="overflow-hidden">
      <div className="grid gap-3 rounded-[24px] material p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="grid min-w-0 flex-1 basis-56 gap-1.5 text-xs font-medium text-ink-secondary">Name
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Roofing" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">Due
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink tabular focus:border-brand focus:outline-none"/>
          </label>
          <button type="button" onClick={() => onDone(null)} className={cn(softAction, "h-10 px-4")}>Cancel</button>
          <button type="submit" disabled={!title.trim() || busy} className={cn(primaryAction, "h-10 disabled:opacity-50")}>Add</button>
        </div>
        {suggestions.length > 0 ? (<div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-tertiary">
            Common:
            {suggestions.map((s) => <button key={s} type="button" onClick={() => setTitle(s)} className={cn("press h-7 cursor-pointer rounded-full bg-surface-sunken px-3 font-medium text-ink-secondary hover:text-ink", focusRing)}>{s}</button>)}
          </div>) : null}
        {date > end ? <p className="text-xs text-warning">That&apos;s after the handover date ({short(end)}). Move the handover in Project settings if the project runs longer.</p> : null}
      </div>
    </motion.form>);
}
