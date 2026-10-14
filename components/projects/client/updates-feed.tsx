"use client";
import * as React from "react";
import { Check } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { groupUpdates, newSince } from "@/lib/client-project";
import type { ClientProjectData } from "@/lib/data/client-project";
import { formatDate, isoDateIn } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { MilestoneChips } from "./milestone-chips";
import { toViewerPhotos, useVisitBaseline } from "./visit-baseline";

/**
 * Everything the project manager accepted, newest first, under milestone
 * headings that stay put while you scroll. Work new since the last visit is
 * marked until the next one.
 */
export function UpdatesFeed({ data }: {
    data: ClientProjectData;
}) {
    const { project, milestones, updates, photos } = data;
    const baseline = useVisitBaseline(project.id);
    const fresh = new Set(newSince(updates, baseline).map((u) => u.id));
    const [filter, setFilter] = React.useState<string | null>(null);
    const [index, setIndex] = React.useState<number | null>(null);
    const groups = groupUpdates(updates, milestones);
    const shown = filter ? groups.filter((g) => g.key === filter) : groups;
    const viewer = toViewerPhotos(photos, milestones);

    if (data.loadFailed && updates.length === 0)
        return <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Updates couldn&apos;t be loaded. Reload to try again.</p>;
    if (updates.length === 0)
        return <p className="materialize rounded-[20px] material px-6 py-7 text-sm text-ink-secondary">Nothing approved yet. When your project manager accepts finished work, it appears here.</p>;

    return (<div className="grid gap-6">
      {groups.length > 1 ? <MilestoneChips options={groups.map((g) => ({ key: g.key, label: g.title }))} value={filter} onChange={setFilter}/> : null}
      {shown.map((g) => (<section key={g.key} aria-labelledby={`updates-${g.key}`}>
          <h2 id={`updates-${g.key}`} className="sticky top-[var(--frame-h,0px)] z-10 -mx-2 bg-canvas/90 px-2 py-2 text-sm font-semibold text-ink backdrop-blur-md">
            {g.title} <span className="font-normal text-ink-tertiary tabular">{g.items.length}</span>
          </h2>
          <ol className="mt-2 grid gap-3">
            {g.items.map((u) => {
                const own = photos.filter((p) => p.task_id === u.id);
                return (<li key={u.id} className="materialize rounded-[20px] material p-4 sm:p-5">
                  <div className="flex items-start gap-3">
                    <span className="mt-0.5 grid size-7 shrink-0 place-items-center rounded-full bg-success-soft text-success" aria-hidden><Check className="size-3.5" strokeWidth={3}/></span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[15px] font-semibold text-ink">
                        {u.title}
                        {fresh.has(u.id) ? <span className="ml-2 inline-flex items-center gap-1 align-middle text-[11px] font-medium text-brand"><span className="size-1.5 rounded-full bg-copper" aria-hidden/>New</span> : null}
                      </p>
                      <p className="text-xs text-ink-tertiary">Accepted {formatDate(isoDateIn(u.at), { weekday: "short", month: "short", day: "numeric" })}</p>
                      {own.length > 0 ? (<ul className="mt-3 flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
                          {own.map((p) => {
                              const at = viewer.findIndex((v) => v.id === p.id);
                              return (<li key={p.id} className="shrink-0">
                                <button type="button" onClick={() => setIndex(at)} className={cn("press block size-20 overflow-hidden rounded-xl bg-surface-sunken sm:size-24", focusRing)} aria-label={`Open photo: ${viewer[at]?.caption ?? u.title}`}>
                                  {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
                                  <img src={p.url} alt="" className="size-full object-cover"/>
                                </button>
                              </li>);
                          })}
                        </ul>) : null}
                    </div>
                  </div>
                </li>);
            })}
          </ol>
        </section>))}
      <PhotoViewer photos={viewer} index={index} onIndex={setIndex} onClose={() => setIndex(null)}/>
    </div>);
}
