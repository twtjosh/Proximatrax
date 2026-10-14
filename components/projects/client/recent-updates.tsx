"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { focusRing, OverviewCard } from "@/components/dashboard/overview-kit";
import { projectBoardPath } from "@/lib/constants";
import type { ClientUpdate } from "@/lib/data/client-project";
import { formatDate, isoDateIn, type DashboardMilestone } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

const SHOWN = 3;

/** The newest work your project manager accepted, with the way to everything else. */
export function RecentUpdates({ projectId, updates, milestones, fresh }: {
    projectId: string;
    updates: ClientUpdate[];
    milestones: Pick<DashboardMilestone, "id" | "title">[];
    /** Updates new since the last visit. */
    fresh: Set<string>;
}) {
    return (<OverviewCard id="recent-updates" title="Recent updates" aside={updates.length > 0 ? (<Link href={projectBoardPath(projectId)} className={cn("inline-flex items-center gap-0.5 rounded-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>
          All {updates.length}<ArrowUpRight className="size-3.5" aria-hidden/>
        </Link>) : undefined} className="materialize">
      {updates.length === 0 ? (<p className="px-5 pb-5 text-sm leading-relaxed text-ink-secondary sm:px-6">Nothing accepted yet. Finished work shows up here once your project manager accepts it.</p>) : (<ol className="px-5 pb-4 sm:px-6">
          {updates.slice(0, SHOWN).map((u) => (<li key={u.id} className="flex gap-3 border-t border-line py-3 first:border-t-0">
              <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", fresh.has(u.id) ? "bg-copper shadow-[0_0_0_4px_rgb(217_119_6/0.14)]" : "bg-stage-done")} aria-hidden/>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">
                  {u.title}
                  {fresh.has(u.id) ? <span className="ml-1.5 text-[11px] font-medium text-brand">New</span> : null}
                </span>
                <span className="block truncate text-xs text-ink-tertiary">
                  {milestones.find((m) => m.id === u.milestone_id)?.title ?? "General work"} · {formatDate(isoDateIn(u.at), { weekday: "short", month: "short", day: "numeric" })}
                </span>
              </span>
            </li>))}
        </ol>)}
    </OverviewCard>);
}
