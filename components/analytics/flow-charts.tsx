import { addDays, formatDate } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

/**
 * The Analytics charts: plain HTML marks with their values printed on them.
 * Hover targets carry `data-tip` for the page's tooltip.
 */

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/** Change in open work that week, in words: "3 more left open", "2 fewer left open". */
const balanceWords = (added: number, done: number) => (added > done ? `${added - done} more left open` : done > added ? `${done - added} fewer left open` : "Open work unchanged");

/**
 * Each week as a pair on one baseline: new tasks (grey, context) beside
 * finished ones (copper, the point). Orange taller than grey means the week
 * cleared more than came in. A one-off flood of new tasks (a whole plan
 * arriving at once) is cut at twice the best finished week and its count
 * printed, so it doesn't flatten every other bar. Numbers are printed on
 * this week and on cut bars only; every week has a tooltip.
 */
export function WeekColumns({ accepted, added, weeks, average }: { accepted: number[]; added: number[]; weeks: string[]; average?: number }) {
    const topDone = Math.max(1, ...accepted), topNew = Math.max(0, ...added);
    const max = Math.max(topDone, Math.min(topNew, topDone * 2));
    const h = (v: number) => `${(Math.min(v, max) / max) * 84}%`;
    const last = accepted.length - 1;
    return (<div>
      <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-ink-secondary" aria-hidden>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-(--series-other)"/>New tasks</span>
        <span className="inline-flex items-center gap-1.5"><span className="size-2.5 rounded-[3px] bg-copper"/>Finished (you accepted them)</span>
      </div>
      <div className="relative flex h-48 items-end gap-2 border-b border-line-strong" role="img" aria-label={`Each week, oldest first, new tasks and finished tasks: ${weeks.map((_, i) => `${added[i]} new, ${accepted[i]} finished`).join("; ")}.`}>
        {/* The usual week, as a reference line labelled with its value: orange bars above it beat a usual week. */}
        {average ? (<span className="pointer-events-none absolute inset-x-0 border-t border-dashed border-ink-tertiary/70" style={{ bottom: h(average) }} aria-hidden>
            <span className="absolute -top-1 left-0 -translate-y-full rounded bg-surface/90 px-1 text-[11px] font-medium text-ink-tertiary tabular">Usual week: about {Math.max(1, Math.round(average))} finished</span>
          </span>) : null}
        {accepted.map((done, i) => {
            const fresh = added[i], cut = fresh > max, now = i === last;
            return (<div key={weeks[i]} className={cn("group/col relative flex h-full flex-1 items-end justify-center gap-0.5 rounded-t-md", now && "bg-copper-soft")} data-tip={`${now ? "This week · " : ""}${weekRange(weeks[i])}
${fresh} new · ${done} finished
${balanceWords(fresh, done)}`}>
                {[["new", fresh, cut], ["done", done, false]].map(([kind, v, clipped]) => (<span key={kind as string} className="relative flex h-full max-w-4 flex-1 flex-col justify-end">
                    {(now || clipped) && (v as number) > 0 ? <span className={cn("mb-0.5 text-center text-[11px] font-semibold tabular", kind === "done" ? "text-ink" : "text-ink-secondary")}>{v as number}</span> : null}
                    <span className={cn("block rounded-t-[4px] transition-opacity group-hover/col:opacity-80", kind === "done" ? "bg-copper" : "bg-(--series-other)", clipped && "mask-[linear-gradient(to_bottom,transparent_0,black_10px)]")} style={{ height: (v as number) ? h(v as number) : 0 }}/>
                  </span>))}
              </div>);
        })}
      </div>
      <div className="mt-1.5 flex justify-between text-[11.5px] text-ink-tertiary" aria-hidden>
        <span>{short(weeks[0])}</span>
        <span>{short(weeks[Math.floor(last / 2)])}</span>
        <span className="font-semibold text-copper-hover">This week</span>
      </div>
      <p className="mt-3 text-[12px] leading-snug text-ink-tertiary">How to read it: each pair is one week. When the orange bar is taller than the grey one, your team finished more than came in, so the pile of open work got smaller.</p>
    </div>);
}

/** "Oct 9 to 15", or "Sep 28 to Oct 4" across a month. */
export function weekRange(start: string): string {
    const end = addDays(start, 6);
    return `${short(start)} to ${end.slice(5, 7) === start.slice(5, 7) ? Number(end.slice(8)) : short(end)}`;
}
