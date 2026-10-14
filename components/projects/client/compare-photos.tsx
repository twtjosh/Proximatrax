"use client";
import * as React from "react";
import { animate, useReducedMotion } from "framer-motion";
import { ChevronsLeftRight } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import type { ClientPhoto } from "@/lib/client-project";
import { formatDate, isoDateIn } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

const short = (iso: string) => formatDate(isoDateIn(iso), { month: "short", day: "numeric" });

/**
 * Two approved photos on top of each other with a handle to wipe between
 * them: the space before against the space now. Defaults to the oldest and
 * newest; either side can be swapped for any other photo. The handle drags,
 * and takes arrow keys, Home and End.
 */
export function ComparePhotos({ photos }: {
    /** Approved photos, newest first; at least two. */
    photos: ClientPhoto[];
}) {
    const reduce = useReducedMotion();
    const [beforeId, setBeforeId] = React.useState(photos[photos.length - 1].id);
    const [afterId, setAfterId] = React.useState(photos[0].id);
    const [pos, setPos] = React.useState(50);
    const [dragging, setDragging] = React.useState(false);
    const frame = React.useRef<HTMLDivElement>(null);
    const before = photos.find((p) => p.id === beforeId) ?? photos[photos.length - 1];
    const after = photos.find((p) => p.id === afterId) ?? photos[0];

    // Each new pair opens with a short wipe, so it is plain the handle moves.
    React.useEffect(() => {
        if (reduce)
            return;
        const controls = animate(88, 50, { ...SPRING, duration: 1.1, onUpdate: setPos });
        return () => controls.stop();
    }, [beforeId, afterId, reduce]);

    function follow(clientX: number) {
        const r = frame.current?.getBoundingClientRect();
        if (r)
            setPos(Math.min(Math.max(((clientX - r.left) / r.width) * 100, 0), 100));
    }

    return (<div className="mx-auto grid w-full max-w-5xl gap-4">
      <div ref={frame} onPointerDown={(e) => {
            e.currentTarget.setPointerCapture(e.pointerId);
            setDragging(true);
            follow(e.clientX);
        }} onPointerMove={(e) => {
            if (dragging)
                follow(e.clientX);
        }} onPointerUp={() => setDragging(false)} onPointerCancel={() => setDragging(false)} className="materialize relative aspect-[4/3] w-full cursor-ew-resize touch-none overflow-hidden rounded-[22px] bg-surface-sunken select-none sm:aspect-[16/9]">
        {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
        <img src={after.url} alt={`After: ${after.taskTitle}`} draggable={false} className="absolute inset-0 size-full object-cover"/>
        {/* eslint-disable-next-line @next/next/no-img-element -- approved site photos from storage */}
        <img src={before.url} alt={`Before: ${before.taskTitle}`} draggable={false} className="absolute inset-0 size-full object-cover" style={{ clipPath: `inset(0 ${100 - pos}% 0 0)` }}/>
        <span className="absolute top-3 left-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">Before · {short(before.at)}</span>
        <span className="absolute top-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white backdrop-blur-md">After · {short(after.at)}</span>
        <span aria-hidden className="pointer-events-none absolute inset-y-0 w-0.5 -translate-x-1/2 bg-white shadow-[0_0_12px_rgb(0_0_0/0.4)]" style={{ left: `${pos}%` }}/>
        <span role="slider" tabIndex={0} aria-label="Compare before and after" aria-valuemin={0} aria-valuemax={100} aria-valuenow={Math.round(pos)} aria-valuetext={`${Math.round(pos)}% before`} onKeyDown={(e) => {
            const step = e.shiftKey ? 20 : 5;
            if (e.key === "ArrowLeft")
                setPos((p) => Math.max(p - step, 0));
            else if (e.key === "ArrowRight")
                setPos((p) => Math.min(p + step, 100));
            else if (e.key === "Home")
                setPos(0);
            else if (e.key === "End")
                setPos(100);
            else
                return;
            e.preventDefault();
        }} className={cn("absolute top-1/2 grid size-12 -translate-x-1/2 -translate-y-1/2 place-items-center rounded-full bg-white text-ink shadow-[0_8px_24px_-6px_rgb(0_0_0/0.5)] transition-transform duration-300 ease-spring", dragging && "scale-110", focusRing)} style={{ left: `${pos}%` }}>
          <ChevronsLeftRight className="size-5" aria-hidden/>
        </span>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        <Picker label="Before" photos={photos} value={before.id} onChange={setBeforeId}/>
        <Picker label="After" photos={photos} value={after.id} onChange={setAfterId}/>
      </div>
    </div>);
}

function Picker({ label, photos, value, onChange }: {
    label: string;
    photos: ClientPhoto[];
    value: string;
    onChange: (id: string) => void;
}) {
    return (<fieldset className="min-w-0 rounded-[20px] material p-3">
      <legend className="sr-only">{label} photo</legend>
      <p className="px-1 pb-2 text-xs font-medium text-ink-tertiary">{label}</p>
      <div className="flex gap-2 overflow-x-auto pb-1 [scrollbar-width:thin]">
        {photos.map((p) => (<label key={p.id} className="shrink-0 cursor-pointer">
            <input type="radio" name={`compare-${label}`} value={p.id} checked={value === p.id} onChange={() => onChange(p.id)} className="peer sr-only"/>
            <span className="block size-16 overflow-hidden rounded-xl opacity-60 ring-2 ring-transparent transition-[opacity,box-shadow] duration-300 peer-checked:opacity-100 peer-checked:ring-copper peer-focus-visible:ring-ink hover:opacity-90">
              {/* eslint-disable-next-line @next/next/no-img-element -- thumbnails of approved site photos */}
              <img src={p.url} alt={`${p.taskTitle}, ${short(p.at)}`} className="size-full object-cover"/>
            </span>
          </label>))}
      </div>
    </fieldset>);
}
