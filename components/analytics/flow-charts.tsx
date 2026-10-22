import * as React from "react";
import { addDays, formatDate } from "@/lib/dashboard";
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

/** First, middle and last week under a weekly chart, each by its last day, so the right edge is today. */
export function WeekAxis({ weeks, className }: { weeks: string[]; className?: string }) {
    const picks = [...new Set([0, Math.floor((weeks.length - 1) / 2), weeks.length - 1])];
    return (<div className={cn("mt-1.5 flex justify-between text-[11.5px] text-ink-tertiary", className)} aria-hidden>
      {picks.map((i) => <span key={i}>{short(addDays(weeks[i], 6))}</span>)}
    </div>);
}

const niceTop = (max: number, step: number) => Math.max(step, Math.ceil(max / step) * step);

/** Tasks accepted each week as a filled line, tasks added as a plain one: the gap between them is open work growing or shrinking. */
export function AreaChart({ accepted, added, weeks }: { accepted: number[]; added: number[]; weeks: string[] }) {
    const id = React.useId();
    const n = accepted.length, top = niceTop(Math.max(...accepted, ...added), 4);
    const x = (i: number) => (n === 1 ? 50 : (i / (n - 1)) * 100), y = (v: number) => 100 - (v / top) * 100;
    const pts = accepted.map((v, i) => [x(i), y(v)]), inPts = added.map((v, i) => [x(i), y(v)]);
    const step = n === 1 ? 100 : 100 / (n - 1);
    return (<div className="pl-8">
      <div className="relative h-56" role="img" aria-label={`Tasks accepted each week: ${accepted.join(", ")}. Tasks added: ${added.join(", ")}.`}>
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
          <path d={smooth(inPts)} fill="none" stroke="var(--series-2)" strokeWidth={2} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
          <path d={smooth(pts)} fill="none" stroke="var(--copper)" strokeWidth={2.5} strokeLinecap="round" vectorEffect="non-scaling-stroke"/>
        </svg>
        <span className="absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper ring-[3px] ring-surface" style={{ left: `${x(n - 1)}%`, top: `${y(accepted[n - 1])}%` }} aria-hidden/>
        {accepted.map((v, i) => {
            const left = Math.max(0, x(i) - step / 2), at = `${((x(i) - left) / step) * 100}%`;
            return (<div key={i} className="group/pt absolute inset-y-0" style={{ left: `${left}%`, width: `${step}%` }} data-tip={`${weekRange(weeks[i])}
${v} accepted · ${added[i]} added`}>
              <span className="absolute inset-y-0 w-px bg-line-strong opacity-0 transition-opacity group-hover/pt:opacity-100" style={{ left: at }}/>
              <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--series-2)] opacity-0 ring-2 ring-surface transition-opacity group-hover/pt:opacity-100" style={{ left: at, top: `${y(added[i])}%` }}/>
              <span className="absolute size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-copper opacity-0 ring-2 ring-surface transition-opacity group-hover/pt:opacity-100" style={{ left: at, top: `${y(v)}%` }}/>
            </div>);
        })}
      </div>
      <WeekAxis weeks={weeks}/>
    </div>);
}

/** "Oct 9 to 15", or "Sep 28 to Oct 4" across a month. */
export function weekRange(start: string): string {
    const end = addDays(start, 6);
    return `${short(start)} to ${end.slice(5, 7) === start.slice(5, 7) ? Number(end.slice(8)) : short(end)}`;
}
