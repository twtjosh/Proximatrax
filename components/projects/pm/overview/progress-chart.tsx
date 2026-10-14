"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { formatDate } from "@/lib/dashboard";
import type { ProgressPoint } from "@/lib/project-insights";

const W = 560;
const H = 200;
const PAD = { top: 16, right: 16, bottom: 26, left: 30 };
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/**
 * Accepted work week by week (copper) against the straight-line plan (dashed
 * reference). Below the line is behind. Hover or move the keyboard focus
 * across it for the numbers; a table carries the same data for screen readers.
 */
export function ProgressChart({ points, total }: {
    points: ProgressPoint[];
    total: number;
}) {
    const reduce = useReducedMotion();
    const [hover, setHover] = React.useState<number | null>(null);
    const svg = React.useRef<SVGSVGElement>(null);
    const n = points.length;
    const max = Math.max(total, 1);
    const ix = (i: number) => PAD.left + (n > 1 ? (i / (n - 1)) * (W - PAD.left - PAD.right) : (W - PAD.left - PAD.right) / 2);
    const iy = (v: number) => PAD.top + (1 - v / max) * (H - PAD.top - PAD.bottom);
    const line = (key: "accepted" | "planned") => points.map((p, i) => `${i ? "L" : "M"}${ix(i).toFixed(1)},${iy(p[key]).toFixed(1)}`).join(" ");
    const area = n ? `${line("accepted")} L${ix(n - 1).toFixed(1)},${iy(0)} L${ix(0).toFixed(1)},${iy(0)} Z` : "";
    const last = points.at(-1);
    const gap = last ? last.accepted - last.planned : 0;
    const ticks = [0, Math.round(max / 2), max].filter((v, i, a) => a.indexOf(v) === i);
    const shown = hover ?? n - 1;

    function pick(clientX: number) {
        const box = svg.current?.getBoundingClientRect();
        if (!box || n === 0)
            return;
        const x = ((clientX - box.left) / box.width) * W;
        const i = Math.round(((x - PAD.left) / (W - PAD.left - PAD.right)) * (n - 1));
        setHover(Math.min(Math.max(i, 0), n - 1));
    }

    return (<OverviewCard id="project-progress" title="Progress" aside={last ? <span className={gap >= 0 ? "font-medium text-success" : "font-medium text-warning"}>{gap === 0 ? "On plan" : gap > 0 ? `${gap} ahead of plan` : `${-gap} behind plan`}</span> : undefined} className="materialize" style={stagger(4)}>
      {n < 2 ? (<p className="px-6 pt-1 pb-6 text-sm text-ink-tertiary">{total === 0 ? "Add tasks to see progress against the plan." : "The chart starts once the first week has passed."}</p>) : (<div className="px-3 pb-4 sm:px-4">
          <div className="flex items-center gap-4 px-2 pb-1 text-xs text-ink-secondary">
            <span className="inline-flex items-center gap-1.5"><span className="h-0.5 w-4 rounded-full bg-copper" aria-hidden/>Accepted</span>
            <span className="inline-flex items-center gap-1.5"><span className="w-4 border-t-2 border-dashed border-ink-tertiary" aria-hidden/>Plan</span>
            <span className="ml-auto tabular" aria-live="polite">{short(points[shown].date)}: <b className="font-semibold text-ink">{points[shown].accepted}</b> accepted · plan {points[shown].planned}</span>
          </div>
          <svg ref={svg} viewBox={`0 0 ${W} ${H}`} className="w-full touch-pan-y outline-none" role="img" aria-label={`Accepted tasks by week against the plan. Latest: ${last!.accepted} of ${total} accepted, plan ${last!.planned}.`} tabIndex={0} onPointerMove={(e) => pick(e.clientX)} onPointerLeave={() => setHover(null)} onKeyDown={(e) => {
                if (e.key === "ArrowLeft" || e.key === "ArrowRight") {
                    e.preventDefault();
                    setHover((h) => Math.min(Math.max((h ?? n - 1) + (e.key === "ArrowRight" ? 1 : -1), 0), n - 1));
                }
            }} onBlur={() => setHover(null)}>
            <defs>
              <linearGradient id="progress-fill" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="var(--copper)" stopOpacity="0.22"/>
                <stop offset="1" stopColor="var(--copper)" stopOpacity="0"/>
              </linearGradient>
            </defs>
            {ticks.map((v) => (<g key={v}>
                <line x1={PAD.left} x2={W - PAD.right} y1={iy(v)} y2={iy(v)} stroke="var(--line)" strokeWidth="1"/>
                <text x={PAD.left - 8} y={iy(v)} dy="0.32em" textAnchor="end" className="fill-ink-tertiary text-[10px] tabular">{v}</text>
              </g>))}
            {[0, n - 1].map((i) => <text key={i} x={ix(i)} y={H - 6} textAnchor={i ? "end" : "start"} className="fill-ink-tertiary text-[10px]">{short(points[i].date)}</text>)}
            <path d={line("planned")} fill="none" stroke="var(--ink-tertiary)" strokeWidth="1.5" strokeDasharray="4 4"/>
            <motion.path d={area} fill="url(#progress-fill)" initial={reduce ? false : { opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.6, delay: 0.3 }}/>
            <motion.path d={line("accepted")} fill="none" stroke="var(--copper)" strokeWidth="2.25" strokeLinecap="round" strokeLinejoin="round" initial={reduce ? false : { pathLength: 0 }} animate={{ pathLength: 1 }} transition={{ duration: 0.9, ease: [0.22, 1, 0.36, 1] }}/>
            <line x1={ix(shown)} x2={ix(shown)} y1={PAD.top} y2={iy(0)} stroke="var(--line-strong)" strokeWidth="1" opacity={hover === null ? 0 : 1}/>
            <circle cx={ix(shown)} cy={iy(points[shown].planned)} r="3.5" fill="var(--surface)" stroke="var(--ink-tertiary)" strokeWidth="1.5"/>
            <circle cx={ix(shown)} cy={iy(points[shown].accepted)} r="5" fill="var(--copper)" stroke="var(--surface)" strokeWidth="2"/>
          </svg>
          <table className="sr-only">
            <caption>Accepted tasks by week</caption>
            <thead><tr><th>Week of</th><th>Accepted</th><th>Plan</th></tr></thead>
            <tbody>{points.map((p) => <tr key={p.date}><td>{short(p.date)}</td><td>{p.accepted}</td><td>{p.planned}</td></tr>)}</tbody>
          </table>
        </div>)}
    </OverviewCard>);
}
