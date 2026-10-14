"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { focusRing } from "@/components/dashboard/overview-kit";
import { PhotoViewer, type ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import { groupByDay, newSince } from "@/lib/client-project";
import type { ClientProjectData } from "@/lib/data/client-project";
import { BUSINESS_TIME_ZONE, daysBetween, formatDate, isoDateIn } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { askAbout } from "@/components/messenger/messenger-store";
import { AskAbout } from "./ask-about";
import { MilestoneChips } from "./milestone-chips";
import { toViewerPhotos, useVisitBaseline } from "./visit-baseline";

const time = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: BUSINESS_TIME_ZONE });
const dayLabel = (day: string, today: string) => {
    const ago = daysBetween(day, today);
    return ago === 0 ? "Today" : ago === 1 ? "Yesterday" : formatDate(day, { weekday: "long", month: "long", day: "numeric" });
};

/**
 * Everything the project manager accepted, as one timeline by day, newest
 * first. Each entry names its milestone and carries its photos; work new
 * since the last visit is marked. Chips narrow it to one milestone.
 */
export function UpdatesFeed({ data }: {
    data: ClientProjectData;
}) {
    const { project, milestones, updates, photos, today } = data;
    const reduce = useReducedMotion();
    const baseline = useVisitBaseline(project.id);
    const fresh = new Set(newSince(updates, baseline).map((u) => u.id));
    const [filter, setFilter] = React.useState<string | null>(null);
    const [viewer, setViewer] = React.useState<{ list: ViewerPhoto[]; index: number } | null>(null);
    const options = [
        ...[...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).filter((m) => updates.some((u) => u.milestone_id === m.id)).map((m) => ({ key: m.id, label: m.title })),
        ...(updates.some((u) => u.milestone_id === null) ? [{ key: "general", label: "General work" }] : []),
    ];
    const shown = filter ? updates.filter((u) => (u.milestone_id ?? "general") === filter) : updates;
    const days = groupByDay(shown);
    const all = toViewerPhotos(photos, milestones);
    const latest = updates.reduce<string | null>((max, u) => (max === null || Date.parse(u.at) > Date.parse(max) ? u.at : max), null);

    if (data.loadFailed && updates.length === 0)
        return <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Updates couldn&apos;t be loaded. Reload to try again.</p>;
    if (updates.length === 0) {
        return (<section className="materialize max-w-xl rounded-[20px] material px-6 py-7">
          <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Nothing accepted yet</h2>
          <p className="mt-2 text-sm leading-relaxed text-ink-secondary">When your project manager accepts finished work, it appears here with its photos, newest first.</p>
        </section>);
    }

    return (<div className="grid gap-5">
      <div className="materialize flex flex-wrap items-center justify-between gap-x-6 gap-y-3">
        <p className="text-sm text-ink-secondary">
          <b className="font-semibold text-ink tabular">{updates.length}</b> accepted
          {latest ? <> · latest {formatDate(isoDateIn(latest), { weekday: "short", month: "short", day: "numeric" })}</> : null}
          {fresh.size > 0 ? <> · <span className="font-medium text-brand">{fresh.size} new</span></> : null}
        </p>
        {options.length > 1 ? <MilestoneChips options={options} value={filter} onChange={setFilter}/> : null}
      </div>
      <section aria-label="Accepted work" className="materialize rounded-[20px] material px-2 py-2 sm:px-3">
        <AnimatePresence mode="popLayout" initial={false}>
          {days.map((d) => (<motion.div key={`${filter ?? "all"}-${d.day}`} layout={!reduce} initial={reduce ? { opacity: 0 } : { opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, transition: { duration: 0.12 } }} transition={SPRING}>
              <h2 className="sticky top-[var(--frame-h,0px)] z-10 rounded-xl bg-surface/95 px-3 pt-3 pb-1.5 text-xs font-semibold text-ink-secondary backdrop-blur-md">{dayLabel(d.day, today)}</h2>
              <ol className="relative mx-3 mb-2 border-l border-line pl-6">
                {d.items.map((u) => {
                    const own = all.filter((p, k) => photos[k].task_id === u.id);
                    const milestone = milestones.find((m) => m.id === u.milestone_id)?.title ?? "General work";
                    return (<li key={u.id} className="relative py-3">
                      <span aria-hidden className={cn("absolute top-[18px] -left-[30px] size-3 rounded-full ring-4 ring-surface", fresh.has(u.id) ? "bg-copper" : "bg-stage-done")}/>
                      <div className="flex items-start gap-2">
                        <div className="flex min-w-0 flex-1 flex-wrap items-baseline gap-x-2 gap-y-1">
                          <p className="text-[15px] font-semibold tracking-[-0.01em] text-ink">{u.title}</p>
                          {fresh.has(u.id) ? <span className="rounded-full bg-brand-soft px-2 py-0.5 text-[11px] font-semibold text-brand">New</span> : null}
                        </div>
                        <AskAbout projectId={project.id} subject={u.title} label="Ask" className="-my-1.5 -mr-1"/>
                      </div>
                      <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-ink-tertiary">
                        <span className="rounded-full bg-surface-sunken px-2 py-0.5 font-medium text-ink-secondary">{milestone}</span>
                        <span className="tabular">Accepted {time.format(new Date(u.at))}</span>
                      </p>
                      {own.length > 0 ? (<ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                          {own.map((p, k) => (<li key={p.id} className="shrink-0">
                              <button type="button" onClick={() => setViewer({ list: own, index: k })} aria-label={`Open photo: ${p.caption}`} className={cn("group press block size-24 overflow-hidden rounded-xl bg-surface-sunken sm:size-28", focusRing)}>
                                {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
                                <img src={p.url} alt="" className="size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.05]"/>
                              </button>
                            </li>))}
                        </ul>) : null}
                    </li>);
                })}
              </ol>
            </motion.div>))}
        </AnimatePresence>
      </section>
      <PhotoViewer photos={viewer?.list ?? []} index={viewer?.index ?? null} onIndex={(index) => setViewer((v) => (v ? { ...v, index } : v))} onClose={() => setViewer(null)} onAsk={(p) => {
            setViewer(null);
            askAbout(project.id, `this photo (${p.caption})`);
        }}/>
    </div>);
}
