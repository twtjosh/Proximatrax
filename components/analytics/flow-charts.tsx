import * as React from "react";
import { formatDate } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

/**
 * The Analytics charts. Lines and fills are SVG stretched to the box; labels,
 * dots and hover targets are HTML laid over it, so text stays readable at any
 * width. Hover targets carry `data-tip` for the page's tooltip.
 */

/** A smooth path through points (Catmull-Rom as cubic Béziers). */
function smooth(p: number[][]): string {
    if (p.length === 0) return "";
    let d = `M${p[0][0]},${p[0][1]}`;
    for (let i = 0; i < p.length - 1; i++) {
        const p0 = p[i - 1] ?? p[i], p1 = p[i], p2 = p[i + 1], p3 = p[i + 2] ?? p2;
        d += ` C${p1[0] + (p2[0] - p0[0]) / 6},${p1[1] + (p2[1] - p0[1]) / 6} ${p2[0] - (p3[0] - p1[0]) / 6},${p2[1] - (p3[1] - p1[1]) / 6} ${p2[0]},${p2[1]}`;
    }
    return d;
}

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/** First, middle and last week under a weekly chart. */
export function WeekAxis({ weeks, className }: { weeks: string[]; className?: string }) {
    const picks = [...new Set([0, Math.floor((weeks.length - 1) / 2), weeks.length - 1])];
    return (<div className={cn("mt-1.5 flex justify-between text-[11.5px] text-ink-tertiary", className)} aria-hidden>
      {picks.map((i) => <span key={i}>{short(weeks[i])}</span>)}
    </div>);
}

/** A tiny trend line for a number tile. Weeks with no value are skipped. Decorative. */
export function Spark({ values }: { values: (number | null)[] }) {
    const pts = values.flatMap((v, i) => (v === null ? [] : [[i, v]]));
    if (pts.length < 2) return <span className="h-7 w-16" aria-hidden/>;
    const vs = pts.map((p) => p[1]), min = Math.min(...vs), rng = Math.max(...vs) - min || 1;
    const xy = pts.map(([i, v]) => [(i / (values.length - 1)) * 64, 3 + 22 * (1 - (v - min) / rng)]);
    const last = xy[xy.length - 1];
    return (<svg viewBox="0 0 64 28" className="h-7 w-16 shrink-0 overflow-visible" aria-hidden>
      <path d={smooth(xy)} fill="none" stroke="var(--copper)" strokeWidth={1.6} strokeLinecap="round" opacity={0.85}/>
      <circle cx={last[0]} cy={last[1]} r={2.6} fill="var(--copper)"/>
    </svg>);
}

const niceTop = (max: number, step: number) => Math.max(step, Math.ceil(max / step) * step);

/** Tasks accepted each week as a filled line, with the period before as a dashed line. */
export function AreaChart({ values, before, weeks }: { values: number[]; before: number[]; weeks: string[] }) {
    const id = React.useId();
    const n = values.length, top = niceTop(Math.max(...values, ...before), 4);
    const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100), y = (v: number) => 100 - (v / top) * 100;
    const pts = values.map((v, i) => [x(i), y(v)]), prev = before.map((v, i) => [x(i), y(v)]);
    const step = n === 1 ? 100 : 100 / (n - 1);
    return (<div className="pl-8">
      <div className="relative h-56" role="img" aria-label={`Tasks accepted each week: ${values.join(", ")}. The period before: ${before.join(", ")}.`}>
        {[0, top / 2, top].map((t) => (<div key={t} className="absolute inset-x-0 border-t border-line" style={{ top: `${y(t)}%` }}>
            <span className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[11.5px] text-ink-tertiary tabular">{t}</span>
          </div>))}
        <svg className="absolute inset-0 size-full overflow-visible" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={id} x1="0" x2="0" y1="0" y2="1">
              <stop offset="0" stopColor="var(--copper)" stopOpacity={0.3}/>
              <stop offset="0.75" stopColor="var(--copper)" stopOpacity={0.05}/>
              <stop offset="1" stopColor="var(--copper)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <path d={`${smooth(pts)} L${x(n - 1)},100 L${x(0)},100 Z`} fill={`url(#${id})`}/>
          <path d={smooth(prev)} fill="none" stroke="var(--ink-tertiary)" strokeWidth={1.5} strokeDasharray="4 5" vectorEffect="non-scaling-stroke" opacity={0.7}/>
          <path d={smooth(pts)} fill="none" stroke="var(--copper)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        </svg>
        <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper ring-[3px] ring-surface" style={{ left: `${x(n - 1)}%`, top: `${y(values[n - 1])}%` }} aria-hidden/>
        {values.map((v, i) => (<div key={i} className="group/pt absolute inset-y-0" style={{ left: `${Math.max(0, x(i) - step / 2)}%`, width: `${step}%` }} data-tip={`Week of ${short(weeks[i])}\n${v} accepted · ${before[i]} the period before`}>
            <span className="absolute inset-y-0 w-px bg-line-strong opacity-0 transition-opacity group-hover/pt:opacity-100" style={{ left: `${((x(i) - Math.max(0, x(i) - step / 2)) / step) * 100}%` }}/>
            <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper opacity-0 ring-2 ring-surface transition-opacity group-hover/pt:opacity-100" style={{ left: `${((x(i) - Math.max(0, x(i) - step / 2)) / step) * 100}%`, top: `${y(v)}%` }}/>
          </div>))}
      </div>
      <WeekAxis weeks={weeks}/>
    </div>);
}

/** Days per week as bars, the latest week solid and labelled, against a dashed typical line. Weeks with no value stay empty. */
export function WeekBars({ values, weeks, typical, tip }: { values: (number | null)[]; weeks: string[]; typical: number | null; tip: (v: number) => string }) {
    const known = values.filter((v): v is number => v !== null);
    const top = niceTop(Math.max(1, typical ?? 0, ...known) + 0.5, 1);
    const pct = (v: number) => (v / top) * 100;
    const last = values.length - 1;
    return (<div className="pr-16 pl-8">
      <div className="relative h-40" role="img" aria-label={`By week: ${values.map((v) => v ?? "none").join(", ")}${typical !== null ? `. Typical ${typical}.` : ""}`}>
        {[0, top].map((t) => (<div key={t} className="absolute inset-x-0 border-t border-line" style={{ bottom: `${pct(t)}%` }}>
            <span className="absolute -left-8 w-6 -translate-y-1/2 text-right text-[11.5px] text-ink-tertiary tabular">{t}</span>
          </div>))}
        {typical !== null ? (<div className="absolute inset-x-0 z-10 border-t border-dashed border-ink-secondary" style={{ bottom: `${pct(typical)}%` }}>
            <span className="absolute -right-16 w-14 -translate-y-1/2 text-[11.5px] text-ink-secondary">Typical {typical}</span>
          </div>) : null}
        <div className="absolute inset-0 flex items-end">
          {values.map((v, i) => (<div key={i} className="relative flex h-full flex-1 items-end justify-center" data-tip={v === null ? `Week of ${short(weeks[i])}\nNothing answered` : `Week of ${short(weeks[i])}\n${tip(v)}`}>
              {v !== null ? <span className={cn("chart-rise block w-[58%] max-w-8 rounded-t-[6px] rounded-b-[3px]", i === last ? "bg-copper" : "bg-copper/35")} style={{ height: `${pct(v)}%`, animationDelay: `${i * 30}ms` }}/> : null}
              {i === last && v !== null ? <b className="absolute text-[12.5px] font-bold text-ink tabular" style={{ bottom: `calc(${pct(v)}% + 4px)` }}>{v}</b> : null}
            </div>))}
        </div>
      </div>
      <WeekAxis weeks={weeks}/>
    </div>);
}

export type Slice = { key: string; label: string; value: number; color: string };

/** Shares of a whole as a ring. `lit` brings one slice forward. Decorative: the legend states the counts. */
export function Donut({ slices, lit }: { slices: Slice[]; lit: string | null }) {
    const total = slices.reduce((s, x) => s + x.value, 0);
    const r = 70, c = 2 * Math.PI * r, gap = slices.filter((s) => s.value > 0).length > 1 ? 3 : 0;
    const lens = slices.map((s) => (total ? (s.value / total) * c : 0));
    const starts = lens.map((_, i) => lens.slice(0, i).reduce((a, b) => a + b, 0));
    return (<svg viewBox="0 0 180 180" className="size-full -rotate-90" aria-hidden>
      <circle cx={90} cy={90} r={r} fill="none" stroke="var(--surface-sunken)" strokeWidth={18}/>
      {slices.map((s, i) => {
            const len = lens[i], at = starts[i];
            return len > gap ? <circle key={s.key} cx={90} cy={90} r={r} fill="none" stroke={s.color} strokeWidth={lit === s.key ? 22 : 18} strokeDasharray={`${len - gap} ${c - len + gap}`} strokeDashoffset={-at} className="transition-[opacity,stroke-width] duration-300" opacity={lit && lit !== s.key ? 0.3 : 1}/> : null;
        })}
    </svg>);
}
