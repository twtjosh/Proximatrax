"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
import { formatDate, plural } from "@/lib/dashboard";
import type { AnalyticsSegment } from "@/services/super-admin-analytics-service";

const W = 600;
const H = 160;
const PAD_TOP = 12;

/**
 * Daily activity as one area. Pointing, dragging a finger or pressing the
 * arrow keys scrubs a crosshair 1:1 across the days; the readout follows.
 */
export function ActivityChart({ points, className }: {
    points: { date: string; count: number }[];
    className?: string;
}) {
    const [active, setActive] = React.useState<number | null>(null);
    const n = points.length;
    const peak = Math.max(1, ...points.map((p) => p.count));
    const x = (i: number) => (n > 1 ? i / (n - 1) : 0.5);
    const y = (v: number) => PAD_TOP + (1 - v / peak) * (H - PAD_TOP);
    const line = points.map((p, i) => `${i === 0 ? "M" : "L"}${(x(i) * W).toFixed(1)},${y(p.count).toFixed(1)}`).join(" ");
    const area = n > 0 ? `${line} L${W},${H} L0,${H} Z` : "";
    const total = points.reduce((s, p) => s + p.count, 0);
    const busiest = points.reduce<(typeof points)[number] | null>((best, p) => (!best || p.count > best.count ? p : best), null);
    const shown = active == null ? null : points[active];

    function indexAt(clientX: number, el: HTMLElement) {
        const r = el.getBoundingClientRect();
        return Math.round(Math.min(Math.max((clientX - r.left) / r.width, 0), 1) * (n - 1));
    }
    function onKeyDown(e: React.KeyboardEvent) {
        const keys: Record<string, number> = { ArrowLeft: -1, ArrowRight: 1 };
        if (e.key in keys)
            setActive((i) => Math.min(Math.max((i ?? n - 1) + keys[e.key], 0), n - 1));
        else if (e.key === "Home")
            setActive(0);
        else if (e.key === "End")
            setActive(n - 1);
        else
            return;
        e.preventDefault();
    }

    if (n === 0)
        return <p className="text-sm text-ink-tertiary">No activity recorded yet.</p>;

    return (<div className={cn("min-w-0", className)}>
      <div tabIndex={0} role="group" aria-roledescription="chart" aria-label={`Daily activity over ${plural(n, "day")}: ${total} in all${busiest && busiest.count > 0 ? `, busiest ${formatDate(busiest.date, { month: "short", day: "numeric" })} with ${busiest.count}` : ""}. Use the arrow keys to read each day.`} onKeyDown={onKeyDown} onBlur={() => setActive(null)} onPointerMove={(e) => setActive(indexAt(e.clientX, e.currentTarget))} onPointerDown={(e) => setActive(indexAt(e.clientX, e.currentTarget))} onPointerLeave={(e) => e.pointerType === "mouse" && setActive(null)} className="relative min-h-48 flex-1 cursor-crosshair touch-pan-y rounded-xl outline-none select-none focus-visible:ring-2 focus-visible:ring-ring">
        <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden>
          <defs>
            <linearGradient id="activity-fill" x1="0" x2="0" y1="0" y2="1">
              <stop offset="0%" stopColor="var(--copper)" stopOpacity="0.16"/>
              <stop offset="100%" stopColor="var(--copper)" stopOpacity="0"/>
            </linearGradient>
          </defs>
          {[0, 0.5].map((r) => (<line key={r} x1={0} x2={W} y1={y(peak * (1 - r))} y2={y(peak * (1 - r))} stroke="var(--line)" strokeDasharray="2 4" vectorEffect="non-scaling-stroke"/>))}
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line-strong)" vectorEffect="non-scaling-stroke"/>
          <path d={area} fill="url(#activity-fill)"/>
          <path d={line} fill="none" stroke="var(--ink)" strokeWidth={1.5} strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        </svg>
        <span className="type-caption absolute left-0 -translate-y-full pb-0.5 text-ink-tertiary tabular" style={{ top: `${(PAD_TOP / H) * 100}%` }} aria-hidden>{peak}</span>

        {shown ? null : <span aria-hidden className="pointer-events-none absolute right-0 size-2.5 translate-x-1/2 -translate-y-1/2 rounded-full bg-copper ring-2 ring-canvas" style={{ top: `${(y(points[n - 1].count) / H) * 100}%` }}/>}
        {shown ? (<>
            <span aria-hidden className="pointer-events-none absolute top-0 bottom-0 w-px bg-line-strong" style={{ left: `${x(active!) * 100}%` }}/>
            <span aria-hidden className="pointer-events-none absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper ring-2 ring-canvas" style={{ left: `${x(active!) * 100}%`, top: `${(y(shown.count) / H) * 100}%` }}/>
            <span role="status" className="pointer-events-none absolute top-1 z-10 rounded-lg bg-popover px-2.5 py-1.5 text-xs whitespace-nowrap shadow-overlay" style={{ left: `${x(active!) * 100}%`, translate: `${x(active!) > 0.7 ? "calc(-100% - 10px)" : "10px"} 0` }}>
              <span className="block text-ink-tertiary">{formatDate(shown.date, { weekday: "short", month: "short", day: "numeric" })}</span>
              <span className="block font-medium text-ink tabular">{shown.count} {shown.count === 1 ? "event" : "events"}</span>
            </span>
          </>) : null}
      </div>
      <div className="type-caption mt-2 flex justify-between text-ink-tertiary tabular" aria-hidden>
        <span>{formatDate(points[0].date, { month: "short", day: "numeric" })}</span>
        <span>{formatDate(points[n - 1].date, { month: "short", day: "numeric" })}</span>
      </div>
    </div>);
}

/** Parts of a whole as a ring with 2px gaps; the centre is the total. Decorative; pair with a legend. */
export function SegmentRing({ segments, size = 128, stroke = 10, children }: {
    segments: AnalyticsSegment[];
    size?: number;
    stroke?: number;
    children?: React.ReactNode;
}) {
    const total = segments.reduce((s, x) => s + x.value, 0);
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const gap = segments.filter((s) => s.value > 0).length > 1 ? 3 : 0;
    let offset = 0;
    return (<span className="relative inline-grid shrink-0 place-items-center" style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={stroke}/>
        {total > 0 ? segments.filter((s) => s.value > 0).map((s) => {
            const len = (s.value / total) * c;
            const arc = (<circle key={s.label} className="ring-draw" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={s.color} strokeWidth={stroke} strokeDasharray={`${Math.max(len - gap, 0.001)} ${c}`} strokeDashoffset={-offset}/>);
            offset += len;
            return arc;
        }) : null}
      </svg>
      <span className="relative text-center">{children}</span>
    </span>);
}

/** Values against their largest as thin single-hue bars, label and figure in ink. */
export function BarList({ items, empty }: {
    items: { id?: string; label: string; sublabel?: string; value: number }[];
    empty: string;
}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    if (items.length === 0)
        return <p className="text-sm text-ink-tertiary">{empty}</p>;
    return (<ul className="space-y-4">
      {items.map((item) => (<li key={item.id ?? item.label}>
          <div className="flex items-baseline justify-between gap-3 text-sm">
            <span className="min-w-0 truncate text-ink">
              {item.label}
              {item.sublabel ? <span className="text-ink-tertiary"> · {item.sublabel}</span> : null}
            </span>
            <span className="shrink-0 font-medium text-ink tabular">{item.value}</span>
          </div>
          <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
            {item.value > 0 ? <div className="h-full origin-left rounded-full bg-copper/70" style={{ width: `${(item.value / max) * 100}%` }}/> : null}
          </div>
        </li>))}
    </ul>);
}

/** A few counts as columns, each labelled with its value; empty columns keep a baseline stub. */
export function ColumnBars({ items, unit }: {
    items: { label: string; count: number }[];
    unit: string;
}) {
    const max = Math.max(1, ...items.map((i) => i.count));
    return (<ul className="grid h-32 grid-flow-col auto-cols-fr items-end gap-3">
      {items.map((item) => (<li key={item.label} className="flex h-full flex-col items-center justify-end gap-1.5" title={`${item.label}: ${plural(item.count, unit)}`}>
          <span className="text-xs font-medium text-ink tabular">{item.count}</span>
          <span aria-hidden className={cn("w-full max-w-7 rounded-t-sm", item.count > 0 ? "bg-copper/60" : "bg-line-strong")} style={{ height: item.count > 0 ? `${(item.count / max) * 70}%` : 2 }}/>
          <span className="type-caption text-ink-tertiary tabular">{item.label}</span>
        </li>))}
    </ul>);
}
