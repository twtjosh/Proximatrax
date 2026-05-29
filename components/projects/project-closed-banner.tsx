import Link from "next/link";
import { Archive, ArrowRight } from "lucide-react";
import { projectsListPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Project } from "@/types/database";
type ProjectClosedBannerProps = {
    project: Project;
    variant?: "pm" | "client" | "middleman";
};
export function ProjectClosedBanner({ project, variant = "pm", }: ProjectClosedBannerProps) {
    if (project.status !== "completed")
        return null;
    const isClient = variant === "client";
    const closedOn = project.completed_at
        ? new Date(project.completed_at).toLocaleDateString(undefined, {
            month: "long",
            day: "numeric",
            year: "numeric",
        })
        : null;
    return (<div className={cn("mb-6 flex flex-col gap-4 rounded-2xl border px-5 py-4 sm:flex-row sm:items-center sm:justify-between", isClient
            ? "border-emerald-200/90 bg-emerald-50/50"
            : "border-emerald-200/80 bg-emerald-50/40")} role="status">
      <div className="flex items-start gap-3">
        <div className={cn("flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ring-1", isClient
            ? "bg-white text-emerald-700 ring-emerald-200/80"
            : "bg-emerald-100/80 text-emerald-800 ring-emerald-200/60")}>
          <Archive className="h-5 w-5" aria-hidden/>
        </div>
        <div>
          <p className={cn("text-[10px] font-medium uppercase tracking-[0.16em]", isClient ? "text-emerald-800/90" : "font-mono tracking-[0.18em] text-emerald-800")}>
            {isClient ? "Completed engagement" : "Archived · read-only"}
          </p>
          <p className="mt-0.5 font-heading text-base font-semibold text-slate-950">
            This project is formally closed
          </p>
          <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
            {isClient ? (<>
                Your engagement with AEG Fashion is complete
                {closedOn ? ` as of ${closedOn}` : ""}. You can review milestones,
                deliverables, and messages here — operational updates are locked.
              </>) : (<>
                Closed{closedOn ? ` on ${closedOn}` : ""}. View deliverables and
                history below; board and phase edits are disabled until reopened.
              </>)}
          </p>
        </div>
      </div>
      <Link href={projectsListPath("completed")} className={cn("inline-flex shrink-0 items-center gap-1.5 rounded-lg border px-3.5 py-2 text-sm font-medium transition-colors", isClient
            ? "border-emerald-200/90 bg-white text-emerald-900 hover:bg-emerald-50"
            : "border-emerald-200/80 bg-white/80 text-emerald-900 hover:bg-white")}>
        Completed archive
        <ArrowRight className="h-3.5 w-3.5" aria-hidden/>
      </Link>
    </div>);
}
