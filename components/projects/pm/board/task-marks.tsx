import { AlarmClock, ChevronsUp } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The two marks a task can carry, kept apart on purpose: lateness is a fact
 * about time, in red with a clock; priority is the PM's choice, in ink with
 * an arrow. Both always say their meaning in words, never colour alone.
 */
export function PriorityTag({ className }: { className?: string }) {
    return (<span className={cn("inline-flex h-5 shrink-0 items-center gap-0.5 rounded-md bg-ink pr-1.5 pl-1 text-[10.5px] font-semibold tracking-[0.02em] text-canvas", className)}>
      <ChevronsUp className="size-3" strokeWidth={2.6} aria-hidden/>Priority
    </span>);
}

export function LateTag({ days, className }: { days: number; className?: string }) {
    return (<span className={cn("inline-flex h-5 shrink-0 items-center gap-1 rounded-md bg-danger-soft px-1.5 text-[11px] font-semibold text-danger tabular", className)}>
      <AlarmClock className="size-3" strokeWidth={2.4} aria-hidden/>{days === 1 ? "1 day late" : `${days} days late`}
    </span>);
}
