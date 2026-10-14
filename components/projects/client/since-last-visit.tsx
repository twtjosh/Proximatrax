"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { focusRing, trackSpotlight } from "@/components/dashboard/overview-kit";
import { projectBoardPath } from "@/lib/constants";
import { plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";

/** "3 new updates since Tuesday", opening Updates where they are marked. Absent when nothing is new. */
export function SinceLastVisit({ projectId, count, label }: {
    projectId: string;
    count: number;
    label: string;
}) {
    if (count === 0)
        return null;
    return (<Link href={projectBoardPath(projectId)} onPointerMove={trackSpotlight} className={cn("spotlight material-interactive press press-soft materialize flex items-center gap-3 rounded-[20px] material p-4", focusRing)}>
      <span className="grid size-10 shrink-0 place-items-center rounded-full bg-copper text-sm font-semibold text-white tabular" aria-hidden>{count}</span>
      <span className="min-w-0 flex-1 text-sm text-ink-secondary"><b className="font-semibold text-ink">{plural(count, "new update")}</b> {label}</span>
      <ArrowUpRight className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
    </Link>);
}
