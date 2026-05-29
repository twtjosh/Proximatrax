"use client";
import Link from "next/link";
import { Eye, LayoutList, Lock, MessageSquare } from "lucide-react";
import { TimelinePhaseCalendar } from "@/components/dashboard/timeline-phase-calendar";
import { TimelineStats } from "@/components/dashboard/timeline-milestone-list";
import { projectBoardPath, projectMessagesPath, projectPath, } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/types/database";
import type { UserRole } from "@/types/enums";
export type ProjectTimelineViewProps = {
    projectId: string;
    projectStart: string;
    projectEnd: string;
    milestones: Milestone[];
    viewerRole: UserRole;
};
export function ProjectTimelineView({ projectId, projectStart, projectEnd, milestones, viewerRole, }: ProjectTimelineViewProps) {
    const isPm = viewerRole === "project_manager";
    const isClient = viewerRole === "client";
    const isMiddleman = viewerRole === "middleman";
    const hasMilestones = milestones.length > 0;
    return (<div className="space-y-5">
      <header>
        <p className={cn(isClient
            ? "text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500"
            : "font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500")}>
          {isClient ? "Your project" : isMiddleman ? "Field coordination" : "Planning & delivery"}
        </p>
        <h2 className={cn("mt-1 font-heading tracking-tight", isClient ? "text-xl font-semibold text-stone-900" : "text-lg text-slate-950")}>
          {isClient ? "Delivery schedule" : "Timeline"}
        </h2>
        <p className="mt-1.5 max-w-xl text-sm text-slate-600">
          {isPm
            ? "Gantt-style roadmap of major phases across the project window."
            : isClient
                ? "When each major phase is scheduled — read only."
                : "Phase schedule for coordination. Task updates live on the Board."}
        </p>
      </header>

      
      <div className={cn("flex flex-wrap items-center justify-between gap-3 rounded-lg border px-4 py-2.5", isClient
            ? "border-stone-200 bg-stone-50/80"
            : isPm
                ? "border-[#d97706]/20 bg-[#d97706]/5"
                : "border-slate-200 bg-slate-50/80")}>
        <p className="flex items-center gap-2 text-sm text-slate-700">
          {isPm ? (<>
              <LayoutList className="h-4 w-4 text-[#d97706]"/>
              Add & complete phases on{" "}
              <Link href={projectPath(projectId)} className="font-medium text-[#9a4f02] hover:underline">
                Overview
              </Link>
            </>) : isMiddleman ? (<>
              <Eye className="h-4 w-4 text-slate-500"/>
              View only · dates set by PM
            </>) : (<>
              <Lock className="h-4 w-4 text-stone-500"/>
              View only ·{" "}
              <Link href={projectMessagesPath(projectId)} className="font-medium text-stone-800 hover:underline">
                message PM
              </Link>{" "}
              to request changes
            </>)}
        </p>
        <div className="flex gap-2">
          {isMiddleman ? (<Link href={projectBoardPath(projectId, { mine: "1" })} className="text-xs font-medium text-[#9a4f02] hover:text-[#d97706]">
              My tasks →
            </Link>) : null}
          {isClient ? (<Link href={projectBoardPath(projectId)} className="text-xs font-medium text-stone-700 hover:text-stone-900">
              Progress board →
            </Link>) : null}
        </div>
      </div>

      {hasMilestones ? (<TimelineStats milestones={milestones} isClient={isClient}/>) : null}

      <TimelinePhaseCalendar projectId={projectId} projectStart={projectStart} projectEnd={projectEnd} milestones={milestones} viewerRole={viewerRole} isClient={isClient}/>
    </div>);
}
