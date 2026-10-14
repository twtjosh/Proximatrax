"use client";
import { Expand } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import type { ViewerPhoto } from "@/components/projects/shared/photo-viewer";
import { cn } from "@/lib/utils";

/** The newest photo your project manager approved, opening the viewer. */
export function LatestPhoto({ photo, onOpen }: {
    photo: ViewerPhoto;
    onOpen: () => void;
}) {
    return (<figure className="materialize overflow-hidden rounded-[20px] material">
      <button type="button" onClick={onOpen} aria-label={`Open photo: ${photo.caption}`} className={cn("group relative block w-full overflow-hidden", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
        {/* eslint-disable-next-line @next/next/no-img-element -- approved site photo from storage */}
        <img src={photo.url} alt="" className="aspect-[4/3] w-full object-cover transition-transform duration-1000 ease-spring group-hover:scale-[1.03]"/>
        <span className="absolute top-3 right-3 grid size-9 place-items-center rounded-full bg-surface/90 text-ink opacity-0 shadow-card transition-opacity duration-300 group-hover:opacity-100 group-focus-visible:opacity-100" aria-hidden><Expand className="size-4"/></span>
      </button>
      <figcaption className="px-4 py-3.5">
        <span className="block text-xs font-medium text-ink-tertiary">Latest photo</span>
        <span className="line-clamp-2 text-sm font-medium text-ink">{photo.caption}</span>
      </figcaption>
    </figure>);
}
