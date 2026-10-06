import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import type { StageCounts } from "@/lib/dashboard";

/**
 * Board stages in completion order: accepted work first, so the filled share
 * reads left to right (or clockwise) as progress. Labels come from the
 * shared vocabulary.
 */
export const STAGES = [
    { key: "done", label: TASK_STAGE_TERMS.done.label, fill: "bg-stage-done", stroke: "var(--stage-done)" },
    { key: "review", label: TASK_STAGE_TERMS.review.label, fill: "bg-stage-review", stroke: "var(--stage-review)" },
    { key: "in_progress", label: TASK_STAGE_TERMS.in_progress.label, fill: "bg-stage-progress", stroke: "var(--stage-progress)" },
    { key: "to_do", label: TASK_STAGE_TERMS.to_do.label, fill: "bg-stage-todo", stroke: "var(--stage-todo)" },
] as const;

/** Tasks by stage as one thin bar of rounded segments. Decorative; callers state counts in text. */
export function StageBar({ stages, total, className }: {
    stages: StageCounts;
    total: number;
    className?: string;
}) {
    return (<span aria-hidden className={cn("flex h-1.5 gap-0.5 overflow-hidden rounded-full", total === 0 && "bg-surface-sunken", className)}>
      {STAGES.filter((s) => stages[s.key] > 0).map((s) => (<span key={s.key} className={cn("rounded-full", s.fill)} style={{ flexGrow: stages[s.key] }}/>))}
    </span>);
}

export type StageKey = (typeof STAGES)[number]["key"];

/** Tasks by stage as a ring; the centre is the caller's. `active` dims every other stage. Decorative. */
export function StageRing({ stages, total, size = 132, stroke = 12, track = "var(--surface-sunken)", active = null, children, className }: {
    stages: StageCounts;
    active?: StageKey | null;
    total: number;
    size?: number;
    stroke?: number;
    track?: string;
    children?: React.ReactNode;
    className?: string;
}) {
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const gap = total > 1 ? 3 : 0;
    const parts = STAGES.filter((s) => stages[s.key] > 0).map((s) => ({ key: s.key, color: s.stroke, len: (stages[s.key] / Math.max(total, 1)) * c }));
    const arcs = parts.map((p, i) => ({
        ...p,
        dash: Math.max(p.len - gap, 0.001),
        offset: parts.slice(0, i).reduce((sum, q) => sum + q.len, 0),
    }));
    return (<span className={cn("relative inline-grid shrink-0 place-items-center", className)} style={{ width: size, height: size }}>
      <svg viewBox={`0 0 ${size} ${size}`} className="absolute inset-0 -rotate-90" aria-hidden>
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={track} strokeWidth={stroke}/>
        {arcs.map((a) => (<circle key={a.key} className="ring-draw" cx={size / 2} cy={size / 2} r={r} fill="none" stroke={a.color} strokeWidth={stroke} strokeLinecap="butt" strokeDasharray={`${a.dash} ${c}`} strokeDashoffset={-a.offset} style={{ opacity: active && active !== a.key ? 0.2 : 1, transition: "opacity 160ms ease-out" }}/>))}
      </svg>
      <span className="relative text-center">{children}</span>
    </span>);
}

/** Screen-reader sentence, e.g. "4 of 10 tasks accepted; 2 in review". */
export function describeStages(stages: StageCounts, total: number) {
    if (total === 0)
        return "No tasks yet";
    const rest = STAGES.slice(1).filter((s) => stages[s.key] > 0).map((s) => `${stages[s.key]} ${s.label.toLowerCase()}`);
    return `${stages.done} of ${total} tasks accepted${rest.length ? `; ${rest.join(", ")}` : ""}`;
}
