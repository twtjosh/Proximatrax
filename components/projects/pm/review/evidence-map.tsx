"use client";
import * as React from "react";
import { Film, ImageIcon, X } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { SiteMap, type LatLng, type MapPoint } from "@/components/projects/shared/site-map";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { evidenceChips } from "@/lib/evidence";
import { cn } from "@/lib/utils";
import type { TaskAttachment } from "@/types/database";

const CHIP = { ok: "text-success", warn: "text-warning", muted: "text-ink-tertiary" } as const;

/**
 * Where a submission's photos and videos were taken, against the site and
 * its on-site circle. Read-only; for the PM deciding to accept or send back.
 */
export function EvidenceMap({ open, onOpenChange, site, items, activeId, when }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    site: LatLng | null;
    items: TaskAttachment[];
    activeId: string | null;
    when: (iso: string) => string;
}) {
    const located = React.useMemo(() => items.filter((i) => i.latitude != null && i.longitude != null), [items]);
    const points = React.useMemo<MapPoint[]>(() => located.map((i, n) => {
        const warn = evidenceChips(i).find((c) => c.tone === "warn" && c.text.endsWith("from site"));
        return { id: i.id, lat: i.latitude!, lng: i.longitude!, label: String(n + 1), active: i.id === activeId, off: i.evidence_flags.includes("off_site"), note: warn?.text };
    }), [located, activeId]);

    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="inset-0 top-0 left-0 flex h-dvh max-w-none translate-x-0 translate-y-0 flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:inset-auto sm:top-1/2 sm:left-1/2 sm:h-[min(44rem,92dvh)] sm:w-[min(56rem,calc(100%-3rem))] sm:max-w-none sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:border">
        <div className="flex items-start gap-3 border-b border-line bg-surface px-4 pt-[max(1rem,env(safe-area-inset-top))] pb-3 sm:px-5">
          <div className="min-w-0 flex-1">
            <DialogTitle className="text-[17px]">Where these were taken</DialogTitle>
            <DialogDescription className="text-[13px]">{site ? "The circle is the site. Amber dots were taken outside it." : "This project's site location isn't set, so distances can't be checked. Set it in Settings."}</DialogDescription>
          </div>
          <DialogClose aria-label="Close" className={cn("press grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-secondary hover:bg-surface-sunken", focusRing)}><X className="size-4" aria-hidden/></DialogClose>
        </div>
        {/* Keyed by what's shown, so each opening fits the view to these points. */}
        <SiteMap key={`${activeId}-${located.length}`} site={site} points={points} label="Map of the site and where each photo or video was taken" className="min-h-0 flex-1"/>
        <ol className="max-h-[34dvh] overflow-y-auto border-t border-line bg-surface px-4 py-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] sm:px-5">
          {items.map((i) => {
                const n = located.indexOf(i);
                const chips = evidenceChips(i);
                return (<li key={i.id} className={cn("flex items-center gap-3 border-b border-line/60 py-2 text-[13px] last:border-0", i.id === activeId && "font-medium")}>
                <span className={cn("grid size-6 shrink-0 place-items-center rounded-full text-[11px] font-semibold text-white", n < 0 ? "bg-line-strong" : i.evidence_flags.includes("off_site") ? "bg-warning" : "bg-success")} aria-hidden>{n < 0 ? "–" : n + 1}</span>
                {i.media_kind === "video" ? <Film className="size-4 shrink-0 text-ink-tertiary" aria-label="Video"/> : <ImageIcon className="size-4 shrink-0 text-ink-tertiary" aria-label="Photo"/>}
                <span className="min-w-0 flex-1 truncate">{chips.map((c, k) => <span key={c.text} className={CHIP[c.tone]}>{k > 0 ? " · " : ""}{c.text}</span>)}</span>
                <span className="shrink-0 text-ink-tertiary tabular">{when(i.taken_at ?? i.created_at)}</span>
              </li>);
            })}
        </ol>
      </DialogContent>
    </Dialog>);
}
