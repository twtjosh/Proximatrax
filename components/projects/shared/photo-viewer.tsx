"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewerPhoto = { id: string; url: string; caption: string };

const control = "grid size-11 place-items-center rounded-full bg-white/12 text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/22 outline-none focus-visible:ring-2 focus-visible:ring-white";

/**
 * Photos full screen on a native modal dialog, which makes the page behind it
 * inert, closes on Esc and returns focus to the opener. Arrow keys and swipes
 * move between photos.
 */
export function PhotoViewer({ photos, index, onIndex, onClose }: {
    photos: ViewerPhoto[];
    /** The photo shown, or null while closed. */
    index: number | null;
    onIndex: (i: number) => void;
    onClose: () => void;
}) {
    const ref = React.useRef<HTMLDialogElement>(null);
    const startX = React.useRef<number | null>(null);
    const open = index !== null && photos.length > 0;
    React.useEffect(() => {
        const dialog = ref.current;
        if (!dialog)
            return;
        if (open && !dialog.open)
            dialog.showModal();
        if (!open && dialog.open)
            dialog.close();
    }, [open]);
    const photo = open ? photos[Math.min(index, photos.length - 1)] : null;
    const go = (step: number) => {
        if (index === null || photos.length < 2)
            return;
        onIndex((index + step + photos.length) % photos.length);
    };
    return (<dialog ref={ref} aria-label="Photos" onClose={onClose} onKeyDown={(e) => {
            if (e.key === "ArrowRight")
                go(1);
            if (e.key === "ArrowLeft")
                go(-1);
        }} onPointerDown={(e) => {
            startX.current = e.clientX;
        }} onPointerUp={(e) => {
            if (startX.current === null)
                return;
            const dx = e.clientX - startX.current;
            startX.current = null;
            if (Math.abs(dx) > 50)
                go(dx < 0 ? 1 : -1);
        }} className="m-0 h-dvh max-h-none w-screen max-w-none bg-transparent p-0 backdrop:bg-black/85 backdrop:backdrop-blur-sm">
      {photo ? (<figure className="flex h-full flex-col items-center justify-center gap-4 p-4 sm:p-12">
          {/* eslint-disable-next-line @next/next/no-img-element -- site photos from storage, shown full size */}
          <img key={photo.id} src={photo.url} alt={photo.caption} draggable={false} className="materialize max-h-[78dvh] max-w-full rounded-2xl object-contain shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)] select-none"/>
          <figcaption className="max-w-xl text-center text-sm text-white/85">
            {photo.caption}
            {photos.length > 1 ? <span className="ml-2 text-white/55 tabular">{index! + 1} of {photos.length}</span> : null}
          </figcaption>
        </figure>) : null}
      <button type="button" onClick={onClose} aria-label="Close" className={cn(control, "absolute top-4 right-4")}><X className="size-5" aria-hidden/></button>
      {photos.length > 1 ? (<>
          <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={cn(control, "absolute top-1/2 left-4 -translate-y-1/2 max-sm:hidden")}><ChevronLeft className="size-5" aria-hidden/></button>
          <button type="button" onClick={() => go(1)} aria-label="Next photo" className={cn(control, "absolute top-1/2 right-4 -translate-y-1/2 max-sm:hidden")}><ChevronRight className="size-5" aria-hidden/></button>
        </>) : null}
    </dialog>);
}
