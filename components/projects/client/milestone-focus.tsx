"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Check, ChevronLeft, ChevronRight } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import type { ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import type { ClientUpdate } from "@/lib/data/client-project";
import { daysBetween, formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import type { Station } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import { AskAbout } from "./ask-about";

export type TaggedPhoto = ViewerPhoto & { milestone_id: string | null };

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const arrow = cn("press grid size-11 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-sunken text-ink hover:bg-line disabled:cursor-default disabled:opacity-35 disabled:hover:bg-surface-sunken", focusRing);

/**
 * One milestone up close: where it stands, the work your project manager
 * accepted in it, and its photos. The arrows step along the route; the
 * journey above picks a milestone too.
 */
export function MilestoneFocus({ projectId, stations, selected, onSelect, nextId, updates, photos, today, onOpenPhoto }: {
    projectId: string;
    stations: Station[];
    selected: string;
    onSelect: (id: string) => void;
    /** The first milestone not yet delivered, if any. */
    nextId: string | null;
    updates: ClientUpdate[];
    photos: TaggedPhoto[];
    today: string;
    onOpenPhoto: (list: ViewerPhoto[], index: number) => void;
}) {
    const reduce = useReducedMotion();
    const i = stations.findIndex((s) => s.id === selected);
    // Which way the content slides: remembered from the last milestone shown.
    const [previous, setPrevious] = React.useState(i);
    const [direction, setDirection] = React.useState(0);
    if (previous !== i) {
        setDirection(i > previous ? 1 : -1);
        setPrevious(i);
    }
    const s = stations[i];
    if (!s)
        return null;
    const work = updates.filter((u) => u.milestone_id === s.id);
    const pics = photos.filter((p) => p.milestone_id === s.id);
    const days = daysBetween(today, s.due_date);
    const chip = s.state === "delivered" ? { label: "Delivered", tone: "bg-success-soft text-success" }
        : s.state === "late" ? { label: "Late", tone: "bg-danger-soft text-danger" }
            : s.id === nextId ? { label: "Next", tone: "bg-brand-soft text-brand" }
                : { label: "Upcoming", tone: "bg-surface-sunken text-ink-secondary" };
    const when = s.state === "delivered" ? `Due ${short(s.due_date)}`
        : days < 0 ? `Was due ${short(s.due_date)} · ${plural(-days, "day")} past its date`
            : days === 0 ? "Due today"
                : `Due ${short(s.due_date)} · in ${plural(days, "day")}`;

    return (<section aria-label="Milestone details" className="materialize overflow-hidden rounded-[20px] material">
      <div className="flex items-center gap-3 border-b border-line px-3 py-3 sm:px-4">
        <button type="button" aria-label="Previous milestone" disabled={i === 0} onClick={() => onSelect(stations[i - 1].id)} className={arrow}><ChevronLeft className="size-5" aria-hidden/></button>
        <div className="min-w-0 flex-1 text-center" aria-live="polite">
          <p className="text-xs text-ink-tertiary tabular">Milestone {i + 1} of {stations.length}</p>
          <p className="truncate text-[15px] font-semibold tracking-[-0.01em] text-ink">{s.title}</p>
        </div>
        <button type="button" aria-label="Next milestone" disabled={i === stations.length - 1} onClick={() => onSelect(stations[i + 1].id)} className={arrow}><ChevronRight className="size-5" aria-hidden/></button>
      </div>
      <AnimatePresence mode="wait" initial={false}>
        <motion.div key={s.id} initial={reduce ? { opacity: 0 } : { opacity: 0, x: direction * 24 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={SPRING} className="px-5 py-5 sm:px-6">
          <div className="flex flex-wrap items-center gap-2">
            <span className={cn("rounded-full px-2.5 py-0.5 text-xs font-semibold", chip.tone)}>{chip.label}</span>
            <span className={cn("text-sm tabular", s.state === "late" ? "font-medium text-danger" : "text-ink-secondary")}>{when}</span>
            <AskAbout projectId={projectId} subject={s.title} className="ml-auto -mr-2"/>
          </div>
          {work.length > 0 ? (<>
              <p className="mt-5 text-xs font-medium text-ink-tertiary">Accepted work</p>
              <ul className="mt-1.5 grid">
                {work.map((u, k) => (<motion.li key={u.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.05 + k * 0.04 }} className="flex items-center gap-3 border-t border-line py-2.5 first:border-t-0">
                    <span className="grid size-6 shrink-0 place-items-center rounded-full bg-success-soft text-success" aria-hidden><Check className="size-3.5" strokeWidth={3}/></span>
                    <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{u.title}</span>
                    <span className="shrink-0 text-xs text-ink-tertiary tabular">{short(isoDateIn(u.at))}</span>
                  </motion.li>))}
              </ul>
            </>) : (<p className="mt-4 max-w-md text-sm leading-relaxed text-ink-secondary">
              {s.state === "delivered" ? "Delivered. No individual pieces of work were shared for this milestone." : "Work for this milestone appears here as your project manager accepts it."}
            </p>)}
          {pics.length > 0 ? (<ul className="mt-4 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]" aria-label="Photos from this milestone">
              {pics.map((p, k) => (<li key={p.id} className="shrink-0">
                  <button type="button" onClick={() => onOpenPhoto(pics, k)} aria-label={`Open photo: ${p.caption}`} className={cn("group press block size-24 overflow-hidden rounded-xl bg-surface-sunken", focusRing)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
                    <img src={p.url} alt="" className="size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.05]"/>
                  </button>
                </li>))}
            </ul>) : null}
        </motion.div>
      </AnimatePresence>
    </section>);
}
