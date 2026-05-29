"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { Stamp } from "lucide-react";
import { cn } from "@/lib/utils";
const HOLD_MS = 850;
type MilestoneDeliveryStampProps = {
    disabled?: boolean;
    onDeliver: () => void;
    className?: string;
    variant?: "default" | "compact";
};
export function MilestoneDeliveryStamp({ disabled, onDeliver, className, variant = "default", }: MilestoneDeliveryStampProps) {
    const [progress, setProgress] = useState(0);
    const [holding, setHolding] = useState(false);
    const rafRef = useRef<number | null>(null);
    const startRef = useRef<number | null>(null);
    const deliveredRef = useRef(false);
    const cancelHold = useCallback(() => {
        if (rafRef.current !== null) {
            cancelAnimationFrame(rafRef.current);
            rafRef.current = null;
        }
        startRef.current = null;
        deliveredRef.current = false;
        setHolding(false);
        setProgress(0);
    }, []);
    const tick = useCallback(() => {
        if (startRef.current === null)
            return;
        const elapsed = Date.now() - startRef.current;
        const pct = Math.min(100, (elapsed / HOLD_MS) * 100);
        setProgress(pct);
        if (pct >= 100 && !deliveredRef.current) {
            deliveredRef.current = true;
            cancelHold();
            onDeliver();
            return;
        }
        rafRef.current = requestAnimationFrame(tick);
    }, [cancelHold, onDeliver]);
    const startHold = useCallback(() => {
        if (disabled)
            return;
        deliveredRef.current = false;
        startRef.current = Date.now();
        setHolding(true);
        rafRef.current = requestAnimationFrame(tick);
    }, [disabled, tick]);
    useEffect(() => cancelHold, [cancelHold]);
    const compact = variant === "compact";
    const ringRadius = compact ? 14 : 18;
    const svgSize = compact ? "h-8 w-8" : "h-10 w-10";
    const innerSize = compact ? "h-5 w-5" : "h-7 w-7";
    const iconSize = compact ? "h-3 w-3" : "h-3.5 w-3.5";
    const circumference = 2 * Math.PI * ringRadius;
    const dashOffset = circumference - (progress / 100) * circumference;
    const viewBox = compact ? "0 0 32 32" : "0 0 40 40";
    const center = compact ? 16 : 20;
    return (<button type="button" disabled={disabled} aria-label="Hold to stamp this phase as delivered" onPointerDown={(e) => {
            e.preventDefault();
            startHold();
        }} onPointerUp={cancelHold} onPointerLeave={cancelHold} onPointerCancel={cancelHold} onContextMenu={(e) => e.preventDefault()} className={cn("group/stamp relative inline-flex touch-none select-none items-center text-left transition-colors", compact ? "gap-2 rounded-md px-2 py-1.5" : "gap-2.5 rounded-lg px-3 py-2", "border border-copper/25 bg-white/80", "hover:border-copper/40 hover:bg-copper-soft/35 active:scale-[0.98]", "disabled:pointer-events-none disabled:opacity-50", holding && "border-copper/50 bg-copper-soft/50 shadow-[0_0_0_2px_rgba(217,119,6,0.12)]", className)}>
      <span className={cn("relative flex shrink-0 items-center justify-center", svgSize)}>
        <svg className={cn("absolute inset-0 -rotate-90", svgSize)} viewBox={viewBox} aria-hidden>
          <circle cx={center} cy={center} r={ringRadius} fill="none" stroke="currentColor" strokeWidth="2" className="text-slate-200"/>
          <circle cx={center} cy={center} r={ringRadius} fill="none" stroke="currentColor" strokeWidth={compact ? 2 : 2.5} strokeLinecap="round" strokeDasharray={circumference} strokeDashoffset={dashOffset} className="text-copper transition-[stroke-dashoffset] duration-75"/>
        </svg>
        <span className={cn("relative flex items-center justify-center rounded-full bg-navy text-white transition-transform", innerSize, holding && "scale-110", progress >= 100 && "scale-125")}>
          <Stamp className={iconSize} strokeWidth={2}/>
        </span>
      </span>
      <span className="min-w-0">
        {!compact ? (<span className="block font-mono text-[9px] uppercase tracking-[0.16em] text-copper">
            Delivery stamp
          </span>) : null}
        <span className={cn("block font-medium text-charcoal", compact ? "text-[11px] leading-tight" : "text-xs")}>
          {holding ? "Keep holding…" : compact ? "Hold to deliver" : "Hold to mark delivered"}
        </span>
      </span>
    </button>);
}
