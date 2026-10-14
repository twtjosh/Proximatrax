"use client";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight } from "lucide-react";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { projectBoardPath } from "@/lib/constants";
import type { TeamMember } from "@/lib/data/project-context";
import { SPRING } from "@/lib/motion";
import { peopleLoad } from "@/lib/people-load";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";

/**
 * Who is on the project and what each person is carrying: open work, what is
 * late, what waits on the PM. The busiest crew member comes first, so an
 * overloaded person is obvious; each opens their work on the Board.
 */
export function PeoplePanel({ open, onOpenChange, projectId, team, tasks, today }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    projectId: string;
    team: TeamMember[];
    tasks: { assigned_to: string | null; stage: string; due_date: string | null }[];
    today: string;
}) {
    const reduce = useReducedMotion();
    const load = peopleLoad(team, tasks, today);
    const crew = load.filter((p) => p.role === ROLE_TERMS.middleman);
    const most = Math.max(1, ...crew.map((p) => p.open));
    return (<Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-line bg-canvas p-0 sm:max-w-md">
        <SheetHeader className="border-b border-line px-6 pt-6 pb-4">
          <SheetTitle className="text-lg font-semibold tracking-[-0.02em] text-ink">People</SheetTitle>
          <SheetDescription className="text-sm text-ink-tertiary">{crew.length === 1 ? "1 person" : `${crew.length} people`} on site · who is carrying what</SheetDescription>
        </SheetHeader>
        <ul className="grid gap-2.5 overflow-y-auto p-4">
          {load.map((p, i) => {
                const isCrew = p.role === ROLE_TERMS.middleman;
                return (<motion.li key={p.id} initial={reduce ? false : { opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: 0.05 + i * 0.04 }} className="rounded-2xl material p-4">
                <div className="flex items-center gap-3">
                  <Face person={p} size={40}/>
                  <span className="min-w-0 flex-1 leading-tight">
                    <span className="block truncate text-[15px] font-semibold text-ink">{p.name}</span>
                    <span className="block text-xs text-ink-tertiary">{p.role}</span>
                  </span>
                  {isCrew || p.open > 0 ? (<Link href={projectBoardPath(projectId, { assignee: p.id })} onClick={() => onOpenChange(false)} className={cn("press inline-flex h-9 shrink-0 items-center gap-1 rounded-full px-3 text-xs font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
                      Their work<ArrowUpRight className="size-3.5" aria-hidden/>
                    </Link>) : null}
                </div>
                {isCrew ? (<>
                    <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
                      <motion.div className={cn("h-full rounded-full", p.late > 0 ? "bg-stage-late" : "bg-copper")} initial={reduce ? false : { width: 0 }} animate={{ width: `${(p.open / most) * 100}%` }} transition={{ ...SPRING, duration: 0.9, delay: 0.15 + i * 0.05 }}/>
                    </div>
                    <p className="mt-2 flex flex-wrap gap-x-3 text-xs text-ink-secondary tabular">
                      <span><b className="font-semibold text-ink">{p.open}</b> open</span>
                      <span className={p.late > 0 ? "font-medium text-danger" : ""}><b className="font-semibold">{p.late}</b> late</span>
                      <span className={p.review > 0 ? "font-medium text-warning" : ""}><b className="font-semibold">{p.review}</b> waiting on you</span>
                    </p>
                  </>) : null}
              </motion.li>);
            })}
        </ul>
      </SheetContent>
    </Sheet>);
}
