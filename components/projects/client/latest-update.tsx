"use client";
import { Check, Expand } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import type { ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import { cn } from "@/lib/utils";

/** The newest approved photo, large; with no photo, the newest accepted work as words. */
export function LatestUpdate({ photo, text, onOpen }: {
    photo: ViewerPhoto | undefined;
    text: { title: string; line: string } | undefined;
    onOpen: () => void;
}) {
    if (photo) {
        return (<figure className="materialize overflow-hidden rounded-[24px] material">
          <button type="button" onClick={onOpen} className={cn("group relative block w-full overflow-hidden", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")} aria-label={`Open photo: ${photo.caption}`}>
            {/* eslint-disable-next-line @next/next/no-img-element -- approved site photo from storage */}
            <img src={photo.url} alt={photo.caption} className="aspect-[16/8] w-full object-cover transition-transform duration-1000 ease-spring group-hover:scale-[1.02] max-sm:aspect-[4/3]"/>
            <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-surface/90 text-ink opacity-0 shadow-card transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden><Expand className="size-4"/></span>
          </button>
          <figcaption className="flex items-center gap-3 px-5 py-4 sm:px-6">
            <span className="text-xs font-medium text-ink-tertiary">Latest update</span>
            <span className="min-w-0 flex-1 truncate text-sm font-medium text-ink">{photo.caption}</span>
          </figcaption>
        </figure>);
    }
    if (!text)
        return null;
    return (<section aria-label="Latest update" className="materialize flex items-center gap-4 rounded-[24px] material p-5 sm:p-6">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-success-soft text-success" aria-hidden><Check className="size-5" strokeWidth={2.5}/></span>
      <span className="min-w-0">
        <span className="block text-xs font-medium text-ink-tertiary">Latest update</span>
        <span className="block truncate text-[17px] font-semibold tracking-[-0.016em] text-ink">{text.title}</span>
        <span className="block truncate text-xs text-ink-tertiary">{text.line}</span>
      </span>
    </section>);
}
