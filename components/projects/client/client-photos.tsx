"use client";
import * as React from "react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import type { ClientProjectData } from "@/lib/data/client-project";
import { cn } from "@/lib/utils";
import { MilestoneChips } from "./milestone-chips";
import { toViewerPhotos } from "./visit-baseline";

/** Every photo the project manager approved, in an even grid, filterable by milestone. */
export function ClientPhotos({ data }: {
    data: ClientProjectData;
}) {
    const { milestones, photos } = data;
    const [filter, setFilter] = React.useState<string | null>(null);
    const [index, setIndex] = React.useState<number | null>(null);
    const options = [
        ...[...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).filter((m) => photos.some((p) => p.milestone_id === m.id)).map((m) => ({ key: m.id, label: m.title })),
        ...(photos.some((p) => p.milestone_id === null) ? [{ key: "other", label: "Other work" }] : []),
    ];
    const shown = filter ? photos.filter((p) => (p.milestone_id ?? "other") === filter) : photos;
    const viewer = toViewerPhotos(shown, milestones);

    if (photos.length === 0)
        return <p className="materialize rounded-[20px] material px-6 py-7 text-sm text-ink-secondary">Approved photos from the site will appear here.</p>;

    return (<div className="grid gap-5">
      {options.length > 1 ? <MilestoneChips options={options} value={filter} onChange={(key) => { setIndex(null); setFilter(key); }}/> : null}
      <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
        {viewer.map((p, i) => (<li key={p.id} className="materialize" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
            <button type="button" onClick={() => setIndex(i)} className={cn("group press relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken", focusRing)} aria-label={`Open photo: ${p.caption}`}>
              {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
              <img src={p.url} alt="" className="size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.03]"/>
            </button>
          </li>))}
      </ul>
      <PhotoViewer photos={viewer} index={index} onIndex={setIndex} onClose={() => setIndex(null)}/>
    </div>);
}
