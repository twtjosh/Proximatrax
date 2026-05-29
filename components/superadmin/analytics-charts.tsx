"use client";
import { cn } from "@/lib/utils";
import type { AnalyticsSegment } from "@/services/super-admin-analytics-service";
function polarToCartesian(cx: number, cy: number, r: number, angleDeg: number) {
    const rad = ((angleDeg - 90) * Math.PI) / 180;
    return { x: cx + r * Math.cos(rad), y: cy + r * Math.sin(rad) };
}
function describeArc(cx: number, cy: number, r: number, startAngle: number, endAngle: number) {
    const start = polarToCartesian(cx, cy, r, endAngle);
    const end = polarToCartesian(cx, cy, r, startAngle);
    const largeArc = endAngle - startAngle <= 180 ? 0 : 1;
    return `M ${start.x} ${start.y} A ${r} ${r} 0 ${largeArc} 0 ${end.x} ${end.y}`;
}
export function AnalyticsDonutChart({ segments, size = 96, className, }: {
    segments: AnalyticsSegment[];
    size?: number;
    className?: string;
}) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    const cx = size / 2;
    const cy = size / 2;
    const radius = size * 0.38;
    const stroke = size * 0.13;
    if (total === 0) {
        return (<div className={cn("flex items-center justify-center text-xs text-slate-500", className)} style={{ width: size, height: size }}>
        No data
      </div>);
    }
    let cursor = 0;
    const arcs = segments.map((segment) => {
        const sweep = (segment.value / total) * 360;
        const start = cursor;
        const end = cursor + sweep;
        cursor = end;
        return { ...segment, start, end: Math.max(start + 0.5, end - 0.5) };
    });
    return (<div className={cn("relative shrink-0", className)} style={{ width: size, height: size }} aria-hidden>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={cx} cy={cy} r={radius} fill="none" stroke="#e2e8f0" strokeWidth={stroke}/>
        {arcs.map((arc) => arc.value > 0 ? (<path key={arc.label} d={describeArc(cx, cy, radius, arc.start, arc.end)} fill="none" stroke={arc.color} strokeWidth={stroke} strokeLinecap="butt"/>) : null)}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-heading text-base font-semibold tabular-nums text-slate-900 dark:text-white">
          {total}
        </span>
      </div>
    </div>);
}
export function AnalyticsLegend({ segments, compact, className, }: {
    segments: AnalyticsSegment[];
    compact?: boolean;
    className?: string;
}) {
    const total = segments.reduce((sum, s) => sum + s.value, 0);
    return (<ul className={cn("w-full min-w-0", compact ? "space-y-1" : "space-y-1.5", className)} aria-label="Chart legend">
      {segments.map((segment) => (<li key={segment.label} className={cn("flex items-center justify-between gap-2", compact
                ? "px-0 py-0.5"
                : "rounded-md bg-slate-50/80 px-2 py-1.5 dark:bg-zinc-900/50")}>
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: segment.color }}/>
            <span className={cn("leading-snug text-slate-800 dark:text-zinc-200", compact ? "text-xs" : "text-sm")}>
              {segment.label}
            </span>
          </span>
          <span className={cn("shrink-0 font-semibold tabular-nums text-slate-900 dark:text-white", compact ? "text-xs" : "text-sm")}>
            {total > 0 ? Math.round((segment.value / total) * 100) : 0}%
          </span>
        </li>))}
    </ul>);
}
const BAR_TRACK_PX = 52;
const BAR_TRACK_PX_DENSE = 44;
export function AnalyticsBarChart({ items, dense, className, }: {
    items: {
        label: string;
        count: number;
    }[];
    dense?: boolean;
    className?: string;
}) {
    const trackPx = dense ? BAR_TRACK_PX_DENSE : BAR_TRACK_PX;
    const max = Math.max(1, ...items.map((i) => i.count));
    return (<div className={cn(className)}>
      <div className="flex items-end justify-between gap-1">
        {items.map((item) => {
            const barPx = item.count > 0
                ? Math.max(8, Math.round((item.count / max) * trackPx))
                : 0;
            return (<div key={item.label} className="flex min-w-0 flex-1 flex-col items-center">
              <span className="mb-0.5 text-[10px] font-semibold tabular-nums text-slate-800">
                {item.count}
              </span>
              <div className="flex w-full items-end justify-center" style={{ height: trackPx }}>
                {barPx > 0 ? (<div className="w-[80%] max-w-9 rounded-t-sm bg-[#2563eb]" style={{ height: barPx }}/>) : (<div className="h-0.5 w-[80%] max-w-9 rounded-full bg-slate-200"/>)}
              </div>
              <span className="mt-1 w-full text-center text-[9px] font-medium leading-tight text-slate-600">
                {item.label}
              </span>
            </div>);
        })}
      </div>
    </div>);
}
export function AnalyticsHorizontalBars({ items, compact, className, }: {
    items: {
        id?: string;
        label: string;
        sublabel?: string;
        value: number;
    }[];
    compact?: boolean;
    className?: string;
}) {
    const max = Math.max(1, ...items.map((i) => i.value));
    return (<ul className={cn(compact ? "space-y-1.5" : "space-y-3", className)}>
      {items.length === 0 ? (<li className="text-xs text-slate-500">No activity yet.</li>) : (items.map((item, index) => {
            const pct = item.value > 0 ? (item.value / max) * 100 : 0;
            return (<li key={item.id ?? `${item.label}-${index}`}>
              <div className="mb-0.5 flex items-center justify-between gap-2">
                <span className="min-w-0 truncate text-[11px] font-medium text-slate-800 dark:text-zinc-200">
                  {item.label}
                  {item.sublabel ? (<span className="font-normal text-slate-500"> · {item.sublabel}</span>) : null}
                </span>
                <span className="shrink-0 text-xs font-semibold tabular-nums text-slate-600">
                  {item.value}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-slate-100 dark:bg-zinc-800">
                {pct > 0 ? (<div className="h-full min-w-[3px] rounded-full bg-[#2563eb]" style={{ width: `${pct}%` }}/>) : null}
              </div>
            </li>);
        }))}
    </ul>);
}
export function AnalyticsLineChart({ points, dense, className, }: {
    points: {
        date: string;
        count: number;
    }[];
    dense?: boolean;
    className?: string;
}) {
    const width = 360;
    const height = dense ? 80 : 100;
    const padLeft = 8;
    const padRight = 8;
    const padTop = 10;
    const padBottom = 6;
    const chartW = width - padLeft - padRight;
    const chartH = height - padTop - padBottom;
    const max = Math.max(1, ...points.map((p) => p.count));
    const coords = points.map((p, i) => {
        const x = padLeft + (i / Math.max(1, points.length - 1)) * chartW;
        const y = padTop + chartH - (p.count / max) * chartH;
        return { x, y, ...p };
    });
    const linePath = coords
        .map((c, i) => `${i === 0 ? "M" : "L"} ${c.x.toFixed(1)} ${c.y.toFixed(1)}`)
        .join(" ");
    const formatDate = (iso: string) => {
        const d = new Date(`${iso}T12:00:00`);
        return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    };
    const firstLabel = points[0] ? formatDate(points[0].date) : "";
    const lastLabel = points[points.length - 1]
        ? formatDate(points[points.length - 1].date)
        : "";
    return (<div className={cn("w-full min-w-0", className)}>
      <svg viewBox={`0 0 ${width} ${height}`} className={cn("w-full", dense ? "h-[3.75rem]" : "h-[5.5rem]")} preserveAspectRatio="xMidYMid meet" aria-hidden>
        {[0.5, 1].map((ratio) => {
            const y = padTop + chartH * (1 - ratio);
            return (<line key={ratio} x1={padLeft} x2={width - padRight} y1={y} y2={y} stroke="#e2e8f0" strokeWidth="1"/>);
        })}
        {linePath ? (<path d={linePath} fill="none" stroke="#2563eb" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round"/>) : null}
        {coords.map((c) => (<circle key={c.date} cx={c.x} cy={c.y} r="2.5" fill="#2563eb"/>))}
      </svg>
      <div className={cn("flex justify-between font-medium text-slate-600", dense ? "mt-0.5 text-[9px]" : "mt-1 text-[11px]")}>
        <span>{firstLabel}</span>
        <span className="text-slate-400">30d</span>
        <span>{lastLabel}</span>
      </div>
    </div>);
}
export function ChartCard({ title, subtitle, dense, children, className, }: {
    title: string;
    subtitle?: string;
    dense?: boolean;
    children: React.ReactNode;
    className?: string;
}) {
    return (<div className={cn("min-w-0 rounded-lg border border-slate-200/90 bg-slate-50/30 dark:border-zinc-800 dark:bg-zinc-900/20", dense ? "p-2" : "p-3", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <p className={cn("font-semibold text-slate-800 dark:text-zinc-100", dense ? "text-[11px]" : "text-xs")}>
          {title}
        </p>
        {subtitle ? (<p className="shrink-0 text-[9px] text-slate-500">{subtitle}</p>) : null}
      </div>
      <div className={cn("min-w-0", dense ? "mt-1.5" : "mt-2.5")}>{children}</div>
    </div>);
}
export function DonutWithLegend({ segments, compact = true, }: {
    segments: AnalyticsSegment[];
    compact?: boolean;
}) {
    const size = compact ? 72 : 108;
    return (<div className="flex items-start gap-3">
      <AnalyticsDonutChart segments={segments} size={size} className="mt-0.5"/>
      <AnalyticsLegend segments={segments} compact={compact} className="flex-1 pt-1"/>
    </div>);
}
