"use client";
import * as React from "react";
import Link from "next/link";
import { Camera } from "lucide-react";
import { focusRing, softAction } from "@/components/dashboard/overview-kit";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { projectBoardPath } from "@/lib/constants";
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
        ...(photos.some((p) => p.milestone_id === null) ? [{ key: "general", label: "General work" }] : []),
    ];
    const shown = filter ? photos.filter((p) => (p.milestone_id ?? "general") === filter) : photos;
    const viewer = toViewerPhotos(shown, milestones);

    if (data.loadFailed && photos.length === 0)
        return <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Photos couldn&apos;t be loaded. Reload to try again.</p>;
    if (photos.length === 0) {
        return (<section className="materialize flex max-w-xl flex-col items-start gap-4 rounded-[20px] material px-6 py-7 sm:flex-row">
          <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-brand-soft text-brand" aria-hidden><Camera className="size-6"/></span>
          <div>
            <h2 className="text-[17px] font-semibold tracking-[-0.016em] text-ink">No site photos yet</h2>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">The crew photograph their work on site. When your project manager accepts that work, its photos are shared with you here, by milestone.</p>
            {data.updates.length > 0 ? <Link href={projectBoardPath(data.project.id)} className={cn(softAction, "mt-4 h-10 px-4")}>See accepted work</Link> : null}
          </div>
        </section>);
    }

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
