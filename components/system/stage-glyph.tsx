import { cn } from "@/lib/utils";

/**
 * How each stage looks in a list of someone's own work: the tinted heading
 * strip (band) and the ring marker that fills as the work moves along.
 */
export const STAGE_LOOK = {
    sent_back: { band: "bg-brand-soft text-brand", glyph: "text-copper", fill: 0.5 },
    in_progress: { band: "bg-info-soft text-info", glyph: "text-stage-progress", fill: 0.5 },
    review: { band: "bg-warning-soft text-warning", glyph: "text-stage-review", fill: 0.75 },
    to_do: { band: "bg-neutral-soft text-ink-secondary", glyph: "text-ink-tertiary", fill: 0 },
    done: { band: "bg-success-soft text-success", glyph: "text-stage-done", fill: 1 },
} as const;
export type StageLook = (typeof STAGE_LOOK)[keyof typeof STAGE_LOOK];

/** A ring that fills as work moves along: empty to do, half in progress, three quarters in review, full accepted. */
export function StageGlyph({ look, className }: {
    look: { glyph: string; fill: number };
    className?: string;
}) {
    const a = 2 * Math.PI * look.fill;
    return (<svg viewBox="0 0 16 16" className={cn("size-4 shrink-0", look.glyph, className)} aria-hidden>
      <circle cx="8" cy="8" r="6.25" fill="none" stroke="currentColor" strokeWidth="1.5"/>
      {look.fill >= 1 ? <circle cx="8" cy="8" r="3.5" fill="currentColor"/> : look.fill > 0 ? <path d={`M8 8V4.5A3.5 3.5 0 ${look.fill > 0.5 ? 1 : 0} 1 ${8 + 3.5 * Math.sin(a)} ${8 - 3.5 * Math.cos(a)}Z`} fill="currentColor"/> : null}
    </svg>);
}

/** The tinted strip that opens a stage's group of rows. */
export function StageHeading({ look, title, count, hint }: {
    look: StageLook;
    title: string;
    count: number;
    hint?: string | null;
}) {
    return (<h3 className={cn("flex items-center gap-2.5 border-y border-line px-5 py-2 text-[13px] font-semibold sm:px-6", look.band)}>
      <StageGlyph look={look}/>
      <span>{title}</span>
      <span className="min-w-5 rounded-full bg-white px-1.5 text-center text-[11px] leading-5 tabular shadow-[0_1px_2px_rgb(14_18_34/0.08)]">{count}</span>
      {hint ? <span className="truncate font-normal">{hint}</span> : null}
    </h3>);
}
