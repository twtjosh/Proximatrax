"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, ChevronsLeftRight, Images } from "lucide-react";
import { focusRing, softAction } from "@/components/dashboard/overview-kit";
import { askAbout } from "@/components/messenger/messenger-store";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { projectBoardPath } from "@/lib/constants";
import type { ClientProjectData } from "@/lib/data/client-project";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { ComparePhotos } from "./compare-photos";
import { MilestoneChips } from "./milestone-chips";
import { toViewerPhotos } from "./visit-baseline";

const MODES = [
    { key: "gallery", label: "Gallery", Icon: Images },
    { key: "compare", label: "Before & after", Icon: ChevronsLeftRight },
] as const;

/**
 * Every photo the project manager approved: an even grid filterable by
 * milestone, or two photos side by side under a wipe to see the change.
 */
export function ClientPhotos({ data }: {
    data: ClientProjectData;
}) {
    const { project, milestones, photos } = data;
    const [mode, setMode] = React.useState<"gallery" | "compare">("gallery");
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
            <p className="mt-1.5 text-sm leading-relaxed text-ink-secondary">The crew photograph their work on site. When your project manager accepts that work, its photos are shared with you here, by milestone, and you can compare before and after.</p>
            {data.updates.length > 0 ? <Link href={projectBoardPath(project.id)} className={cn(softAction, "mt-4 h-10 px-4")}>See accepted work</Link> : null}
          </div>
        </section>);
    }

    return (<div className="grid gap-5">
      <div className="materialize flex flex-wrap items-center justify-between gap-3">
        {photos.length > 1 ? (<div role="tablist" aria-label="View" className="flex rounded-full bg-surface-sunken p-1">
            {MODES.map(({ key, label, Icon }) => (<button key={key} type="button" role="tab" aria-selected={mode === key} onClick={() => setMode(key)} className={cn("relative isolate inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-4 text-sm font-medium transition-colors duration-300", mode === key ? "text-ink" : "text-ink-secondary hover:text-ink", focusRing)}>
                {mode === key ? <motion.span layoutId="client-photos-mode" transition={SPRING} aria-hidden className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card"/> : null}
                <Icon className="size-4" aria-hidden/>
                {label}
              </button>))}
          </div>) : <span/>}
        <p className="text-sm text-ink-tertiary"><b className="font-semibold text-ink tabular">{photos.length}</b> approved {photos.length === 1 ? "photo" : "photos"}</p>
      </div>

      {mode === "compare" && photos.length > 1 ? <ComparePhotos photos={photos}/> : (<>
          {options.length > 1 ? <MilestoneChips options={options} value={filter} onChange={(key) => { setIndex(null); setFilter(key); }}/> : null}
          <ul className="grid grid-cols-2 gap-2.5 sm:grid-cols-3 lg:grid-cols-4">
            {viewer.map((p, i) => (<li key={p.id} className="materialize" style={{ "--i": Math.min(i, 12) } as React.CSSProperties}>
                <button type="button" onClick={() => setIndex(i)} className={cn("group press relative block aspect-[4/3] w-full overflow-hidden rounded-2xl bg-surface-sunken", focusRing)} aria-label={`Open photo: ${p.caption}`}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
                  <img src={p.url} alt="" className="size-full object-cover transition-transform duration-700 ease-spring group-hover:scale-[1.04]"/>
                  <span className="absolute inset-x-0 bottom-0 translate-y-full bg-linear-to-t from-black/70 to-transparent px-3 pt-6 pb-2.5 text-left text-xs font-medium text-white transition-transform duration-500 ease-spring group-hover:translate-y-0 group-focus-visible:translate-y-0">{p.caption}</span>
                </button>
              </li>))}
          </ul>
        </>)}
      <PhotoViewer photos={viewer} index={index} onIndex={setIndex} onClose={() => setIndex(null)} onAsk={(p) => {
            setIndex(null);
            askAbout(project.id, `this photo (${p.caption})`);
        }}/>
    </div>);
}
