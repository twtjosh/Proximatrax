import type { Ratio } from "@/lib/analytics-insights";
import { cn } from "@/lib/utils";

/**
 * A precise progress bar: the exact share printed beside it ("33% · 1 of 3
 * tasks"), quarter ticks to read it against, and no minimum width, so equal
 * values always draw equal bars. Names itself, so it needs no legend.
 */
export function Meter({ label, value, unit, fill = "bg-copper", className }: {
    /** Shown before the bar; omit when the bar's card already names it. */
    label?: string;
    value: Ratio;
    /** What is counted, plural: "tasks", "days". */
    unit: string;
    fill?: string;
    className?: string;
}) {
    const pct = value.pct ?? 0;
    // "1 of 1 task", "1 of 3 tasks".
    const noun = value.of === 1 ? unit.replace(/s$/, "") : unit;
    const text = value.pct === null ? `No ${unit} yet` : `${value.pct}% · ${value.n} of ${value.of} ${noun}`;
    return (<div className={cn("grid items-center gap-x-3 gap-y-1", label ? "grid-cols-[6.5rem_minmax(0,1fr)] sm:grid-cols-[6.5rem_minmax(0,1fr)_9.5rem]" : "grid-cols-[minmax(0,1fr)_auto]", className)}>
      {label ? <span className="text-[12.5px] text-ink-secondary">{label}</span> : null}
      <span role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={pct} aria-label={label ? `${label}: ${text}` : text} className="relative h-2 overflow-hidden rounded-full bg-surface-sunken">
        <span className={cn("absolute inset-y-0 left-0 rounded-full transition-[width] duration-500 ease-[var(--ease-spring)] motion-reduce:transition-none", fill)} style={{ width: `${pct}%` }}/>
        {[25, 50, 75].map((t) => <span key={t} className="absolute inset-y-0 w-px bg-surface/90" style={{ left: `${t}%` }} aria-hidden/>)}
      </span>
      <span className={cn("text-[12.5px] whitespace-nowrap text-ink-tertiary tabular", label && "max-sm:col-start-2")}>
        {value.pct === null ? text : <><b className="font-semibold text-ink">{value.pct}%</b> · {value.n} of {value.of} {noun}</>}
      </span>
    </div>);
}
