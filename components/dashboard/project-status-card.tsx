import Link from "next/link";
import { ArrowUpRight, CalendarRange, HardHat, UserRound } from "lucide-react";
import { PM_CARD_HOVER, PM_ICON_HOVER, PM_PROJECT_STATUS_CHIP } from "@/lib/pm-theme";
import { cn } from "@/lib/utils";
import type { ProjectWithRelations } from "@/services/project-service";
import type { ProjectStatus } from "@/types/enums";
type ProjectStatusCardProps = {
    project: ProjectWithRelations;
    className?: string;
    progressPct?: number;
    variant?: "default" | "client";
};
const STATUS_LABELS: Record<ProjectStatus, string> = {
    pending_invites: "Awaiting invites",
    planning: "Not started",
    in_progress: "In progress",
    on_hold: "On hold",
    completed: "Completed",
};
const STATUS_CHIP = PM_PROJECT_STATUS_CHIP;
function formatDate(value: string) {
    return new Date(value).toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
        year: "numeric",
    });
}
export function ProjectStatusCard({ project, className, progressPct = 0, variant = "default", }: ProjectStatusCardProps) {
    const status = (project.status ?? "planning") as ProjectStatus;
    return (<Link href={`/projects/${project.id}`} className={cn("group relative flex h-full flex-col justify-between", variant === "client"
            ? "rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm hover:border-amber-300/60 hover:shadow-md"
            : cn("rounded-2xl border border-cool-grey bg-surface-card p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04)]", PM_CARD_HOVER), className)}>
      <div className={cn("pointer-events-none absolute right-4 top-4 text-cool-grey", PM_ICON_HOVER)}>
        <ArrowUpRight className="h-4 w-4"/>
      </div>

      <div className="space-y-4">
        <div className="flex items-start justify-between gap-3 pr-6">
          <div className="space-y-2">
            {variant === "default" ? (<span className={cn("inline-flex rounded-full px-2.5 py-1 text-[11px] font-medium ring-1 ring-inset", STATUS_CHIP[status])}>
                {STATUS_LABELS[status]}
              </span>) : (<p className="text-[11px] font-medium uppercase tracking-[0.16em] text-amber-700/90">
                Engagement
              </p>)}
            <h3 className="font-heading text-lg font-semibold leading-tight tracking-tight text-ink transition-colors group-hover:text-copper">
              {project.title}
            </h3>
          </div>
        </div>

        {project.description ? (<p className="line-clamp-2 text-sm leading-relaxed text-slate-600">
            {project.description}
          </p>) : null}

        <div className="space-y-2">
          <div className="flex items-center justify-between text-[11px] font-medium text-slate-500">
            <span>Progress</span>
            <span className="tabular-nums text-slate-900">{progressPct}%</span>
          </div>
          <div className="h-1.5 overflow-hidden rounded-full bg-cool-grey/80">
            <div className="h-full rounded-full bg-copper transition-all" style={{ width: `${progressPct}%` }}/>
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-2 border-t border-slate-100 pt-4 text-xs text-slate-500">
        <div className="flex items-center gap-2">
          <HardHat className="h-3.5 w-3.5 text-slate-400"/>
          <span className="text-slate-700">
            {project.pm?.full_name ?? "Unassigned PM"}
          </span>
        </div>
        {variant === "client" ? null : (<div className="flex items-center gap-2">
            <UserRound className="h-3.5 w-3.5 text-slate-400"/>
            <span>{project.client?.full_name ?? "Unassigned client"}</span>
          </div>)}
        <div className="flex items-center gap-2">
          <CalendarRange className="h-3.5 w-3.5 text-slate-400"/>
          <span>
            {formatDate(project.start_date)} → {formatDate(project.end_date)}
          </span>
        </div>
      </div>
    </Link>);
}
