import { addDays, formatDate } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

/**
 * The Analytics charts: plain HTML marks with their values printed on them.
 * Hover targets carry `data-tip` for the page's tooltip.
 */

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/** First, middle and last week under a weekly chart, each by its last day, so the right edge is today. */
export function WeekAxis({ weeks, className }: { weeks: string[]; className?: string }) {
    const picks = [...new Set([0, Math.floor((weeks.length - 1) / 2), weeks.length - 1])];
    return (<div className={cn("mt-1.5 flex justify-between text-[11.5px] text-ink-tertiary", className)} aria-hidden>
      {picks.map((i) => <span key={i}>{short(addDays(weeks[i], 6))}</span>)}
    </div>);
}

/**
 * Tasks accepted each week as columns on one baseline, the count printed on
 * every week that has one, so nothing needs reading off an axis. One series,
 * so no legend; tasks added are in the tooltip and the table.
 */
export function WeekColumns({ accepted, added, weeks, average }: { accepted: number[]; added: number[]; weeks: string[]; average?: number }) {
    const max = Math.max(1, ...accepted);
    const last = accepted.length - 1;
    return (<div>
      <div className="relative flex h-48 items-end gap-1.5 border-b border-line-strong" role="img" aria-label={`Tasks accepted each week, oldest first: ${accepted.join(", ")}.`}>
        {accepted.map((v, i) => (<div key={weeks[i]} className="group/col relative flex h-full flex-1 flex-col justify-end" data-tip={`${weekRange(weeks[i])}
${v} accepted · ${added[i]} added`}>
            {v ? <span className={cn("mb-1 text-center text-[12px] font-semibold tabular", i === last ? "text-ink" : "text-ink-secondary")}>{v}</span> : null}
            <span className={cn("block rounded-t-[4px] transition-colors", i === last ? "bg-copper" : "bg-copper/45 group-hover/col:bg-copper/70")} style={{ height: v ? `${(v / max) * 82}%` : 0 }}/>
          </div>))}
        {/* The average week, as a reference line labelled with its value: bars above it beat a typical week. */}
        {average ? (<span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-tertiary/70" style={{ bottom: `${(average / max) * 82}%` }} aria-hidden>
            <span className="absolute -top-2 left-0 -translate-y-full rounded bg-surface px-1 text-[11px] font-medium text-ink-tertiary tabular">Average {average} a week</span>
          </span>) : null}
      </div>
      <WeekAxis weeks={weeks}/>
    </div>);
}

/** "Oct 9 to 15", or "Sep 28 to Oct 4" across a month. */
export function weekRange(start: string): string {
    const end = addDays(start, 6);
    return `${short(start)} to ${end.slice(5, 7) === start.slice(5, 7) ? Number(end.slice(8)) : short(end)}`;
}
