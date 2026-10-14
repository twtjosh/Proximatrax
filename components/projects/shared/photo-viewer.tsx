"use client";
import * as React from "react";
import { ChevronLeft, ChevronRight, Download, Loader2, MessageCircleQuestion, X, ZoomIn, ZoomOut } from "lucide-react";
import { cn } from "@/lib/utils";

export type ViewerPhoto = { id: string; url: string; caption: string };

const glass = "bg-white/12 text-white backdrop-blur-md transition-colors duration-300 hover:bg-white/22 outline-none focus-visible:ring-2 focus-visible:ring-white";
const control = cn("grid size-11 cursor-pointer place-items-center rounded-full", glass);
const pill = cn("inline-flex h-10 cursor-pointer items-center gap-2 rounded-full px-4 text-sm font-medium disabled:opacity-60", glass);
/** How far a double-tap zooms in. */
const ZOOM = 2.5;
const clamp = (n: number) => Math.min(Math.max(n, 0), 100);

/** The point under the pointer as percentages of the image, where zoom centres. */
function pointIn(e: { clientX: number; clientY: number }, el: Element) {
    const r = el.getBoundingClientRect();
    return { x: clamp(((e.clientX - r.left) / r.width) * 100), y: clamp(((e.clientY - r.top) / r.height) * 100) };
}

function fileName(photo: ViewerPhoto) {
    const last = decodeURIComponent(photo.url.split("/").pop() ?? "");
    return /\.\w{3,4}$/.test(last) ? last : `site-photo-${photo.id}.jpg`;
}

/**
 * Photos full screen on a native modal dialog, which makes the page behind it
 * inert, closes on Esc and returns focus to the opener. Arrow keys, swipes and
 * the strip move between photos; a double-click or double-tap zooms in where
 * you point and dragging pans. Save downloads the photo. `onAsk` adds "Ask
 * about this photo". `touch-pan-y` keeps a sideways swipe ours instead of the
 * browser's, so it ends in pointerup rather than pointercancel.
 */
export function PhotoViewer({ photos, index, onIndex, onClose, onAsk }: {
    photos: ViewerPhoto[];
    /** The photo shown, or null while closed. */
    index: number | null;
    onIndex: (i: number) => void;
    onClose: () => void;
    onAsk?: (photo: ViewerPhoto) => void;
}) {
    const ref = React.useRef<HTMLDialogElement>(null);
    const strip = React.useRef<HTMLUListElement>(null);
    const startX = React.useRef<number | null>(null);
    const lastTap = React.useRef(0);
    const [zoomed, setZoomed] = React.useState(false);
    const [origin, setOrigin] = React.useState({ x: 50, y: 50 });
    const [saving, setSaving] = React.useState(false);
    // A new photo always starts at full view.
    const [shown, setShown] = React.useState(index);
    if (shown !== index) {
        setShown(index);
        setZoomed(false);
        setOrigin({ x: 50, y: 50 });
    }
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
    React.useEffect(() => {
        strip.current?.querySelector("[aria-current='true']")?.scrollIntoView({ inline: "center", block: "nearest" });
    }, [index]);

    const at = index === null ? 0 : Math.min(index, photos.length - 1);
    const photo = open ? photos[at] : null;
    const go = (step: number) => {
        if (index === null || photos.length < 2)
            return;
        onIndex((index + step + photos.length) % photos.length);
    };
    function zoomAt(e: { clientX: number; clientY: number } | null, el: Element | null) {
        if (zoomed) {
            setZoomed(false);
            return;
        }
        if (e && el)
            setOrigin(pointIn(e, el));
        setZoomed(true);
    }
    async function save() {
        if (!photo)
            return;
        setSaving(true);
        try {
            const blob = await (await fetch(photo.url)).blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = fileName(photo);
            a.click();
            URL.revokeObjectURL(a.href);
        }
        catch {
            window.open(photo.url, "_blank", "noopener");
        }
        finally {
            setSaving(false);
        }
    }

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
            if (!zoomed && Math.abs(dx) > 50)
                go(dx < 0 ? 1 : -1);
        }} onPointerCancel={() => {
            startX.current = null;
        }} className="m-0 h-dvh max-h-none w-screen max-w-none touch-pan-y bg-transparent p-0 backdrop:bg-black/88 backdrop:backdrop-blur-sm">
      <div className="flex h-full flex-col">
        <div className="flex items-center justify-between gap-2 p-3 sm:p-4">
          <div className="flex min-w-0 items-center gap-2">
            {onAsk && photo ? (<button type="button" onClick={() => onAsk(photo)} className={pill}>
                <MessageCircleQuestion className="size-4" aria-hidden/>
                <span className="max-sm:hidden">Ask about this photo</span>
                <span className="sm:hidden">Ask</span>
              </button>) : null}
            <button type="button" onClick={() => void save()} disabled={saving} className={pill}>
              {saving ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Download className="size-4" aria-hidden/>}
              Save
            </button>
            <button type="button" onClick={() => zoomAt(null, null)} aria-label={zoomed ? "Zoom out" : "Zoom in"} aria-pressed={zoomed} className={control}>
              {zoomed ? <ZoomOut className="size-5" aria-hidden/> : <ZoomIn className="size-5" aria-hidden/>}
            </button>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className={control}><X className="size-5" aria-hidden/></button>
        </div>

        {photo ? (<figure className="relative flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 sm:px-20">
            <div className="min-h-0 overflow-hidden rounded-2xl shadow-[0_30px_80px_-20px_rgb(0_0_0/0.7)]">
              {/* eslint-disable-next-line @next/next/no-img-element -- site photos from storage, shown full size */}
              <img key={photo.id} src={photo.url} alt={photo.caption} draggable={false} onDoubleClick={(e) => zoomAt(e, e.currentTarget)} onPointerUp={(e) => {
                    if (e.pointerType !== "touch")
                        return;
                    const now = Date.now();
                    if (now - lastTap.current < 300)
                        zoomAt(e, e.currentTarget);
                    lastTap.current = now;
                }} onPointerMove={(e) => {
                    if (zoomed && (e.pointerType === "mouse" || e.buttons > 0))
                        setOrigin(pointIn(e, e.currentTarget));
                }} style={{ transform: zoomed ? `scale(${ZOOM})` : "none", transformOrigin: `${origin.x}% ${origin.y}%`, touchAction: zoomed ? "none" : "pan-y" }} className={cn("materialize max-h-[calc(100dvh-13rem)] max-w-full object-contain transition-transform duration-500 ease-spring select-none", zoomed ? "cursor-zoom-out" : "cursor-zoom-in")}/>
            </div>
            <figcaption className="max-w-xl text-center text-sm text-white/85">
              {photo.caption}
              {photos.length > 1 ? <span className="ml-2 text-white/55 tabular">{at + 1} of {photos.length}</span> : null}
              <span className="mt-1 block text-xs text-white/45">{zoomed ? "Drag to look around" : "Double-tap to zoom"}</span>
            </figcaption>
            {photos.length > 1 ? (<>
                <button type="button" onClick={() => go(-1)} aria-label="Previous photo" className={cn(control, "absolute top-1/2 left-3 -translate-y-1/2 sm:left-5")}><ChevronLeft className="size-5" aria-hidden/></button>
                <button type="button" onClick={() => go(1)} aria-label="Next photo" className={cn(control, "absolute top-1/2 right-3 -translate-y-1/2 sm:right-5")}><ChevronRight className="size-5" aria-hidden/></button>
              </>) : null}
          </figure>) : null}

        {photos.length > 1 ? (<ul ref={strip} aria-label="All photos" className="mx-auto flex w-fit max-w-full gap-2 overflow-x-auto px-4 pt-3 pb-4 [scrollbar-width:none]">
            {photos.map((p, k) => (<li key={p.id} className="shrink-0">
                <button type="button" onClick={() => onIndex(k)} aria-current={k === at} aria-label={`Photo ${k + 1}: ${p.caption}`} className={cn("block size-14 cursor-pointer overflow-hidden rounded-lg ring-2 transition-[opacity,box-shadow] duration-300 outline-none focus-visible:ring-white", k === at ? "opacity-100 ring-white" : "opacity-55 ring-transparent hover:opacity-90")}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of site photos */}
                  <img src={p.url} alt="" className="size-full object-cover"/>
                </button>
              </li>))}
          </ul>) : null}
      </div>
    </dialog>);
}
