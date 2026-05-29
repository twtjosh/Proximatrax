"use client";
import Link from "next/link";
import { projectBoardPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/enums";
type StageKey = "to_do" | "in_progress" | "review" | "done";
const STAGE_LINKS: Array<{
    key: StageKey;
    label: string;
    param: string;
}> = [
    { key: "to_do", label: "To do", param: "to_do" },
    { key: "in_progress", label: "In progress", param: "in_progress" },
    { key: "review", label: "Review", param: "review" },
    { key: "done", label: "Done", param: "done" },
];
export function OverviewTaskSummary({ projectId, counts, totalTasks, viewerRole, milestoneTotal = 0, milestoneCompleted = 0, deliverableCount = 0, }: {
    projectId: string;
    counts: Record<StageKey, number>;
    totalTasks: number;
    viewerRole: UserRole | null;
    milestoneTotal?: number;
    milestoneCompleted?: number;
    deliverableCount?: number;
}) {
    const isClient = viewerRole === "client";
    const isPm = viewerRole === "project_manager";
    if (isClient) {
        const milestonePct = milestoneTotal
            ? Math.round((milestoneCompleted / milestoneTotal) * 100)
            : 0;
        return (<section className="border border-stone-200/90 bg-white p-5">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-stone-900">
              Progress snapshot
            </h2>
            <p className="mt-1 text-sm text-stone-500">
              Milestone progress and approved site updates — not internal task columns.
            </p>
          </div>
          <Link href={projectBoardPath(projectId)} className="text-sm font-medium text-amber-800 hover:text-amber-900">
            View updates →
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-xl border border-stone-100 bg-stone-50/80 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
              Milestones
            </p>
            <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-stone-900">
              {milestonePct}%
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {milestoneCompleted} of {milestoneTotal || 0} complete
            </p>
          </div>
          <div className="rounded-xl border border-stone-100 bg-stone-50/80 p-4">
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
              Signed-off work
            </p>
            <p className="mt-2 font-heading text-3xl font-semibold tabular-nums text-stone-900">
              {deliverableCount}
            </p>
            <p className="mt-1 text-sm text-stone-600">
              Deliverables shared with you
            </p>
          </div>
        </div>
      </section>);
    }
    return (<section className="border border-slate-200 bg-white p-5">
      <div className="mb-4 flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="font-heading text-lg tracking-tight text-slate-950">
            Tasks
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            {isPm
            ? "Inspection queue is your daily view — use this for stage counts."
            : "Click a column to open work filtered by stage."}
          </p>
        </div>
        {totalTasks > 0 ? (<Link href={isPm
                ? projectBoardPath(projectId, { view: "all" })
                : projectBoardPath(projectId)} className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a4f02] hover:text-[#d97706]">
            {isPm ? "Manage all tasks →" : "Open work →"}
          </Link>) : null}
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {STAGE_LINKS.map(({ key, label, param }) => {
            const count = counts[key];
            return (<Link key={key} href={projectBoardPath(projectId, { stage: param })} className={cn("group border border-slate-100 bg-slate-50 p-3 text-center transition-colors hover:border-[#d97706]/30 hover:bg-[#d97706]/5")}>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500 group-hover:text-slate-700">
                {label}
              </div>
              <div className="mt-2 font-heading text-2xl text-slate-950">
                {count}
              </div>
            </Link>);
        })}
      </div>

      {totalTasks === 0 ? (<p className="mt-4 text-sm text-slate-500">
          No tasks created yet.{" "}
          {isPm
                ? "Open Manage all tasks to add work for your team."
                : "Your project manager adds tasks on the Inspection tab."}
        </p>) : null}
    </section>);
}
