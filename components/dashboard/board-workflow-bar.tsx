"use client";
import { AlertTriangle, ClipboardCheck, Inbox, ShieldCheck } from "lucide-react";
import { cn } from "@/lib/utils";
type BoardWorkflowBarProps = {
    readyUnowned: number;
    activeInProgress: number;
    awaitingPm: number;
    accepted: number;
    total: number;
    isPm: boolean;
    className?: string;
};
export function BoardWorkflowBar({ readyUnowned, activeInProgress, awaitingPm, accepted, total, isPm, className, }: BoardWorkflowBarProps) {
    if (total === 0)
        return null;
    const tiles = [
        {
            label: "Ready pool",
            value: readyUnowned,
            hint: "Unassigned — claim before starting",
            icon: Inbox,
            tone: readyUnowned > 0
                ? "border-amber-200/80 bg-amber-50/80 text-amber-900"
                : "border-cool-grey bg-surface-spotlight text-muted-ink",
        },
        {
            label: "Active",
            value: activeInProgress,
            hint: "Work in progress on site",
            icon: AlertTriangle,
            tone: activeInProgress > 0
                ? "border-sky-200/80 bg-sky-50/80 text-sky-900"
                : "border-cool-grey bg-surface-spotlight text-muted-ink",
        },
        {
            label: "Inspection queue",
            value: awaitingPm,
            hint: isPm ? "Awaiting your sign-off" : "Submitted to PM",
            icon: ClipboardCheck,
            tone: awaitingPm > 0
                ? "border-copper/30 bg-copper-soft/60 text-copper-hover"
                : "border-cool-grey bg-surface-spotlight text-muted-ink",
        },
        {
            label: "Accepted",
            value: accepted,
            hint: "Closed deliverables",
            icon: ShieldCheck,
            tone: "border-emerald-200/80 bg-emerald-50/70 text-emerald-900",
        },
    ];
    return (<div className={cn("grid gap-2 rounded-xl border border-slate-200/90 bg-white p-3 shadow-sm sm:grid-cols-2 lg:grid-cols-4", className)}>
      {tiles.map((tile) => (<div key={tile.label} className={cn("flex cursor-default select-none items-start gap-3 rounded-lg border px-3 py-2.5", tile.tone)}>
          <tile.icon className="mt-0.5 h-4 w-4 shrink-0 opacity-80" strokeWidth={1.75}/>
          <div className="min-w-0">
            <p className="font-mono text-[9px] uppercase tracking-[0.14em] opacity-80">
              {tile.label}
            </p>
            <p className="font-heading text-xl font-semibold tabular-nums leading-none">
              {tile.value}
            </p>
            <p className="mt-1 text-[11px] leading-snug opacity-75">{tile.hint}</p>
          </div>
        </div>))}
    </div>);
}
