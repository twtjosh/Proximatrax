"use client";
import * as React from "react";

/**
 * A number that counts to its value on the same curve and delay as the ring
 * beside it, then glides from old to new when live data changes it. Server
 * HTML holds the final value, so nothing is lost without script or with
 * reduced motion.
 */
export function CountUp({ value, delay = 220, duration = 1400 }: {
    value: number;
    /** ms before counting starts; match the ring's draw delay. */
    delay?: number;
    duration?: number;
}) {
    const ref = React.useRef<HTMLSpanElement>(null);
    const shown = React.useRef<number | null>(null);
    React.useEffect(() => {
        const el = ref.current;
        const from = shown.current ?? 0;
        if (!el || from === value || matchMedia("(prefers-reduced-motion: reduce)").matches) {
            shown.current = value;
            return;
        }
        const start = performance.now() + (from === 0 ? delay : 0);
        let raf = 0;
        const tick = (now: number) => {
            const t = Math.min(Math.max((now - start) / duration, 0), 1);
            const eased = 1 - Math.pow(1 - t, 5); // ease-out quint, the ring's curve
            el.textContent = String(Math.round(from + (value - from) * eased));
            // Only a finished count becomes the next starting point, so an
            // effect that is cancelled and re-run (Strict Mode) starts over.
            if (t < 1)
                raf = requestAnimationFrame(tick);
            else
                shown.current = value;
        };
        el.textContent = String(from);
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, [value, delay, duration]);
    return <span ref={ref}>{value}</span>;
}
