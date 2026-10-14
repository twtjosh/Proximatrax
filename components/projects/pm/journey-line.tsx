"use client";
import Link from "next/link";
import { Check } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { focusRing, stagger } from "@/components/dashboard/overview-kit";
import { daysBetween, formatDate, plural } from "@/lib/dashboard";
import { projectTimelinePath } from "@/lib/constants";
import { journeyProgress, type Station } from "@/lib/pm-project";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/**
 * Milestones as stations on one copper route, filled up to today. It draws
 * itself once; pointing at a station shows its progress. For the PM a station
 * opens the milestone on Schedule; `plain` stations (crew, client) only show
 * it. `showWork={false}` keeps task counts out of the tooltip, for clients.
 * With `onSelect`, stations are buttons and the chosen one is marked.
 * Phones get a row of dots and the one name that matters.
 */
export function JourneyLine({ projectId, stations, today, plain = false, showWork = true, todayLabel = "Today", selected = null, onSelect }: {
    projectId: string;
    stations: Station[];
    today: string;
    plain?: boolean;
    showWork?: boolean;
    todayLabel?: string;
    selected?: string | null;
    onSelect?: (id: string) => void;
}) {
    const reduce = useReducedMotion();
    if (stations.length === 0)
        return null;
    const n = stations.length;
    const progress = journeyProgress(stations, today);
    const edge = `${50 / n}%`;
    const along = `calc(${edge} + (100% - ${100 / n}%) * ${progress})`;
    const focus = stations.find((s) => s.state === "late") ?? stations.find((s) => s.state === "upcoming");
    const delivered = stations.filter((s) => s.state === "delivered").length;

    return (<section aria-label={`Milestones, ${delivered} of ${n} delivered`} className="materialize rounded-[20px] material px-3 pt-11 pb-5 max-sm:pt-4 sm:px-5" style={stagger(1)}>
      <ol className="relative flex max-sm:hidden">
        <span aria-hidden className="absolute top-[18px] h-[3px] rounded-full bg-surface-sunken" style={{ left: edge, right: edge }}>
          <motion.span className="absolute inset-y-0 left-0 rounded-full bg-linear-to-r from-copper to-brand-bright" initial={reduce ? false : { width: 0 }} animate={{ width: `${progress * 100}%` }} transition={{ ...SPRING, duration: 1.1, delay: 0.15 }}/>
        </span>
        {progress > 0 && progress < 1 ? (<span aria-hidden className="absolute -top-8 -translate-x-1/2" style={{ left: along }}>
            <span className="block rounded-full bg-ink px-2 py-0.5 text-[10px] font-semibold whitespace-nowrap text-white">{todayLabel} · {short(today)}</span>
            <span className="mx-auto block h-5 w-0.5 bg-ink"/>
          </span>) : null}
        {stations.map((s, i) => {
            const late = s.state === "late";
            const sub = late ? `${plural(daysBetween(s.due_date, today), "day")} late` : short(s.due_date);
            const body = (<>
                <motion.span initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.1 + i * 0.07 }} className={cn("relative z-10 grid size-[38px] place-items-center rounded-full border-2 text-xs font-semibold transition-transform duration-300 ease-spring group-hover:scale-110", selected === s.id && "scale-110", s.state === "delivered" && "border-copper bg-copper text-white shadow-[0_0_0_5px_rgb(217_119_6/0.14)]", late && "border-stage-late bg-surface text-danger shadow-[0_0_0_5px_rgb(236_78_84/0.14),0_0_0_10px_rgb(236_78_84/0.06)]", s.state === "upcoming" && "border-line bg-surface text-ink-tertiary")}>
                  {s.state === "delivered" ? <Check className="size-4" strokeWidth={2.5} aria-hidden/> : i + 1}
                </motion.span>
                <span className="mt-2 block w-full truncate text-xs font-medium text-ink">{s.title}</span>
                <span className={cn("block text-[11px] tabular", late ? "text-danger" : "text-ink-tertiary")}>{sub}{late && showWork && s.total > 0 ? ` · ${s.accepted}/${s.total}` : ""}</span>
                <span role="tooltip" className="pointer-events-none absolute bottom-[calc(100%+8px)] left-1/2 z-20 w-52 -translate-x-1/2 translate-y-1 rounded-xl bg-ink px-3 py-2.5 text-left text-[11.5px] text-white opacity-0 shadow-[var(--shadow-overlay)] transition-[opacity,translate] duration-300 ease-spring group-hover:translate-y-0 group-hover:opacity-100 group-focus-visible:translate-y-0 group-focus-visible:opacity-100">
                  <span className="block font-semibold">{s.title}</span>
                  <span className="block text-white/70">{s.state === "delivered" ? `Delivered · due ${short(s.due_date)}` : `Due ${short(s.due_date)}`}</span>
                  {!showWork ? null : s.total > 0 ? (<>
                      <span className="my-1.5 block h-1 overflow-hidden rounded-full bg-white/15"><span className="block h-full rounded-full bg-copper" style={{ width: `${(s.accepted / s.total) * 100}%` }}/></span>
                      <span className="block text-white/70">{s.accepted} of {plural(s.total, "task")} accepted</span>
                    </>) : <span className="block text-white/70">No linked tasks</span>}
                </span>
              </>);
            const station = cn("group flex flex-col items-center rounded-xl px-1 text-center", focusRing);
            const mark = onSelect && selected === s.id ? <motion.span layoutId={`journey-pick-${projectId}`} transition={SPRING} aria-hidden className="absolute inset-x-[30%] bottom-0 h-0.5 rounded-full bg-copper"/> : null;
            return (<li key={s.id} className="relative min-w-0 flex-1">
              {onSelect ? <button type="button" aria-pressed={selected === s.id} onClick={() => onSelect(s.id)} className={cn(station, "relative w-full cursor-pointer pb-2")}>{body}{mark}</button> : plain ? <div tabIndex={0} className={station}>{body}</div> : <Link href={`${projectTimelinePath(projectId)}?milestone=${s.id}`} className={station}>{body}</Link>}
            </li>);
        })}
      </ol>
      <div className="sm:hidden">
        <div className="flex items-center gap-1.5" aria-hidden>
          {stations.map((s) => <span key={s.id} className={cn("size-2.5 rounded-full", s.state === "delivered" ? "bg-copper" : s.state === "late" ? "bg-stage-late ring-3 ring-stage-late/20" : "bg-surface-sunken")}/>)}
        </div>
        {focus ? <p className={cn("mt-2 text-xs font-medium", focus.state === "late" ? "text-danger" : "text-ink")}>{focus.title} · {focus.state === "late" ? `${plural(daysBetween(focus.due_date, today), "day")} late` : `due ${short(focus.due_date)}`}</p> : <p className="mt-2 text-xs text-ink-tertiary">Every milestone delivered</p>}
      </div>
    </section>);
}
