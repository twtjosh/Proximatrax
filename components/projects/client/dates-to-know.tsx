"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarPlus, ChevronLeft, ChevronRight } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { addMonths, buildIcs, monthGrid } from "@/lib/calendar";
import { daysBetween, formatDate, plural } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import type { Station } from "@/lib/pm-project";
import { cn } from "@/lib/utils";

const WEEKDAYS = ["S", "M", "T", "W", "T", "F", "S"];
const step = cn("press grid size-10 cursor-pointer place-items-center rounded-full text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing);

type DateItem = { key: string; title: string; date: string; milestoneId: string | null };

function download(item: DateItem, project: string) {
    const ics = buildIcs({ uid: `${item.key}`, title: `${item.title} · ${project}`, date: item.date, description: `${project}, ProximaTrax`, stamp: new Date().toISOString() });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(new Blob([ics], { type: "text/calendar" }));
    a.download = `${item.title.toLowerCase().replace(/[^a-z0-9]+/g, "-")}.ics`;
    a.click();
    URL.revokeObjectURL(a.href);
}

/**
 * The project's dates on a month calendar, so a homeowner can plan around
 * them: milestones by state, today, and the planned finish. Picking a
 * milestone day opens it above; every date still ahead can go straight into
 * the viewer's own calendar.
 */
export function DatesToKnow({ projectTitle, stations, end, today, selected, onSelect }: {
    projectTitle: string;
    stations: Station[];
    /** The project's planned finish date. */
    end: string;
    today: string;
    selected: string | null;
    onSelect: (milestoneId: string) => void;
}) {
    const reduce = useReducedMotion();
    const pick = stations.find((s) => s.id === selected);
    const [month, setMonth] = React.useState((pick?.due_date ?? today).slice(0, 7));
    const [direction, setDirection] = React.useState(0);
    // Picking a milestone anywhere turns the calendar to its month.
    const [followed, setFollowed] = React.useState(selected);
    if (followed !== selected) {
        setFollowed(selected);
        const target = pick?.due_date.slice(0, 7);
        if (target && target !== month) {
            setDirection(target > month ? 1 : -1);
            setMonth(target);
        }
    }
    const byDate = new Map<string, Station[]>();
    for (const s of stations)
        byDate.set(s.due_date, [...(byDate.get(s.due_date) ?? []), s]);
    const ahead: DateItem[] = [
        ...stations.filter((s) => s.state !== "delivered").map((s) => ({ key: s.id, title: s.title, date: s.due_date, milestoneId: s.id })),
        ...(end >= today ? [{ key: `finish-${end}`, title: "Planned finish", date: end, milestoneId: null }] : []),
    ].sort((a, b) => a.date.localeCompare(b.date));

    function go(n: number) {
        setDirection(n);
        setMonth((m) => addMonths(m, n));
    }

    return (<section aria-labelledby="dates-to-know" className="materialize rounded-[20px] material">
      <div className="flex items-center justify-between gap-3 px-5 pt-5 pb-2 sm:px-6">
        <h2 id="dates-to-know" className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Dates to know</h2>
      </div>
      <div className="grid gap-6 px-4 pb-5 sm:px-5 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <div className="flex items-center justify-between px-1">
            <button type="button" onClick={() => go(-1)} aria-label="Previous month" className={step}><ChevronLeft className="size-4" aria-hidden/></button>
            <p className="text-sm font-semibold text-ink" aria-live="polite">{formatDate(`${month}-01`, { month: "long", year: "numeric" })}</p>
            <button type="button" onClick={() => go(1)} aria-label="Next month" className={step}><ChevronRight className="size-4" aria-hidden/></button>
          </div>
          <div className="mt-2 grid grid-cols-7 text-center text-[11px] font-medium text-ink-tertiary" aria-hidden>
            {WEEKDAYS.map((d, i) => <span key={i} className="py-1">{d}</span>)}
          </div>
          <AnimatePresence mode="wait" initial={false}>
            <motion.div key={month} initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: { duration: 0.1 } }} transition={SPRING} role="grid" aria-label={formatDate(`${month}-01`, { month: "long", year: "numeric" })} className="grid gap-y-0.5">
              {monthGrid(month).map((week, w) => (<div key={w} role="row" className="grid grid-cols-7">
                  {week.map((day, k) => {
                        if (!day)
                            return <span key={k} role="gridcell"/>;
                        const marks = byDate.get(day) ?? [];
                        const first = marks[0];
                        const isSelected = marks.some((m) => m.id === selected);
                        const isEnd = day === end;
                        const label = `${formatDate(day, { weekday: "long", month: "long", day: "numeric" })}${day === today ? ", today" : ""}${marks.length ? `: ${marks.map((m) => m.title).join(", ")}` : ""}${isEnd ? ", planned finish" : ""}`;
                        const cell = cn("relative mx-auto grid size-10 place-items-center rounded-full text-sm tabular transition-colors duration-300", isSelected ? "bg-ink font-semibold text-white" : day === today ? "font-semibold text-brand ring-1 ring-brand/40" : marks.length ? "font-medium text-ink" : "text-ink-secondary");
                        const dot = first ? (<span aria-hidden className={cn("absolute bottom-1 size-1.5 rounded-full", isSelected ? "bg-white" : first.state === "delivered" ? "bg-copper" : first.state === "late" ? "bg-stage-late" : "bg-ink-tertiary")}/>) : isEnd ? <span aria-hidden className="absolute bottom-1 h-0.5 w-3 rounded-full bg-copper"/> : null;
                        return (<span key={day} role="gridcell">
                        {first ? (<button type="button" onClick={() => onSelect(first.id)} aria-label={label} aria-pressed={isSelected} className={cn(cell, "press cursor-pointer hover:bg-surface-sunken", isSelected && "hover:bg-ink", focusRing)}>
                            {Number(day.slice(8))}{dot}
                          </button>) : <span aria-label={label} className={cell}>{Number(day.slice(8))}{dot}</span>}
                      </span>);
                    })}
                </div>))}
            </motion.div>
          </AnimatePresence>
          <p className="mt-3 flex flex-wrap gap-x-4 gap-y-1 px-1 text-[11px] text-ink-tertiary">
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-copper" aria-hidden/>Delivered</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-ink-tertiary" aria-hidden/>Coming up</span>
            <span className="flex items-center gap-1.5"><span className="size-1.5 rounded-full bg-stage-late" aria-hidden/>Late</span>
            <span className="flex items-center gap-1.5"><span className="h-0.5 w-3 rounded-full bg-copper" aria-hidden/>Planned finish</span>
          </p>
        </div>

        <div>
          <p className="px-1 text-xs font-medium text-ink-tertiary">Coming up</p>
          {ahead.length === 0 ? <p className="mt-2 px-1 text-sm text-ink-secondary">No dates left. Every milestone is delivered.</p> : (<ul className="mt-1">
              {ahead.map((item) => {
                    const days = daysBetween(today, item.date);
                    return (<li key={item.key} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                    <button type="button" disabled={!item.milestoneId} onClick={() => item.milestoneId && onSelect(item.milestoneId)} className={cn("flex min-w-0 flex-1 items-center gap-3 rounded-xl text-left disabled:cursor-default", item.milestoneId && "cursor-pointer", focusRing)}>
                      <span className="grid w-11 shrink-0 rounded-xl bg-surface-sunken py-1 text-center leading-tight" aria-hidden>
                        <span className="text-[10px] font-semibold text-brand uppercase">{formatDate(item.date, { month: "short" })}</span>
                        <span className="text-[15px] font-semibold text-ink tabular">{Number(item.date.slice(8))}</span>
                      </span>
                      <span className="min-w-0">
                        <span className="block truncate text-sm font-medium text-ink">{item.title}</span>
                        <span className={cn("block text-xs tabular", days < 0 ? "font-medium text-danger" : "text-ink-tertiary")}>{days < 0 ? `${plural(-days, "day")} late` : days === 0 ? "Today" : days === 1 ? "Tomorrow" : `In ${plural(days, "day")}`}</span>
                      </span>
                    </button>
                    <button type="button" onClick={() => download(item, projectTitle)} aria-label={`Add ${item.title} to your calendar`} title="Add to calendar" className={cn("press grid size-10 shrink-0 cursor-pointer place-items-center rounded-full text-ink-secondary hover:bg-brand-soft hover:text-brand", focusRing)}>
                      <CalendarPlus className="size-[18px]" aria-hidden/>
                    </button>
                  </li>);
                })}
            </ul>)}
        </div>
      </div>
    </section>);
}
