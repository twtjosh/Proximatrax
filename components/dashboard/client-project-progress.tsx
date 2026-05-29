import Link from "next/link";
import { CheckCircle2, Circle, Clock3 } from "lucide-react";
import { ApprovedSiteGallery } from "@/components/dashboard/approved-site-gallery";
import { formatDisplayDate, formatRelativeDueDate, getMilestoneStatus, sortMilestones, } from "@/lib/milestone-utils";
import { projectMessagesPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { ApprovedAttachment } from "@/services/task-attachment-service";
import type { Milestone } from "@/types/database";
import type { TaskWithRelations } from "@/services/task-service";
function milestoneTaskProgress(milestoneId: string, tasks: TaskWithRelations[], deliverables: TaskWithRelations[]) {
    const linked = tasks.filter((t) => t.milestone_id === milestoneId);
    const accepted = deliverables.filter((t) => t.milestone_id === milestoneId);
    const doneFromBoard = linked.filter((t) => t.stage === "done").length;
    const total = linked.length;
    const done = Math.max(doneFromBoard, accepted.length);
    const pct = total > 0 ? Math.round((done / total) * 100) : null;
    return { total, done, pct, accepted: accepted.length };
}
export function ClientProjectProgress({ projectId, milestones, tasks, deliverables, approvedPhotos, }: {
    projectId: string;
    milestones: Milestone[];
    tasks: TaskWithRelations[];
    deliverables: TaskWithRelations[];
    approvedPhotos: ApprovedAttachment[];
}) {
    const sorted = sortMilestones(milestones);
    const completedCount = sorted.filter((m) => m.completed).length;
    const progressPct = sorted.length
        ? Math.round((completedCount / sorted.length) * 100)
        : 0;
    return (<div className="space-y-8">
      <section className="rounded-2xl border border-stone-200/90 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-[11px] font-medium uppercase tracking-wide text-stone-500">
              Project progress
            </p>
            <p className="mt-1 font-heading text-3xl font-semibold tabular-nums text-stone-900">
              {progressPct}%
            </p>
            <p className="mt-1 text-sm text-stone-600">
              {completedCount} of {sorted.length || 0} milestones complete
            </p>
          </div>
          <Link href={projectMessagesPath(projectId)} className="text-sm font-medium text-amber-800 hover:text-amber-900">
            Questions? Message your PM →
          </Link>
        </div>
        <div className="mt-4 h-2 overflow-hidden rounded-full bg-stone-100">
          <div className="h-full rounded-full bg-linear-to-r from-amber-600 to-amber-500 transition-all" style={{ width: `${progressPct}%` }}/>
        </div>
      </section>

      <section className="space-y-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            Milestones
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Track major phases — your team updates these as work is signed off.
          </p>
        </div>
        {sorted.length === 0 ? (<p className="rounded-xl border border-dashed border-stone-200 px-5 py-8 text-center text-sm text-stone-500">
            Your project manager is setting up the schedule. Check the Timeline tab
            for dates.
          </p>) : (<ul className="space-y-3">
            {sorted.map((m) => {
                const status = getMilestoneStatus(m);
                const { total, done, pct, accepted } = milestoneTaskProgress(m.id, tasks, deliverables);
                const isComplete = m.completed || status === "completed";
                return (<li key={m.id} className={cn("rounded-xl border px-4 py-4", isComplete
                        ? "border-emerald-200/80 bg-emerald-50/40"
                        : status === "overdue"
                            ? "border-amber-200 bg-amber-50/30"
                            : "border-stone-200/90 bg-white")}>
                  <div className="flex items-start gap-3">
                    {isComplete ? (<CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-emerald-600"/>) : status === "overdue" || status === "due_soon" ? (<Clock3 className="mt-0.5 h-5 w-5 shrink-0 text-amber-700"/>) : (<Circle className="mt-0.5 h-5 w-5 shrink-0 text-stone-300"/>)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <p className="font-medium text-stone-900">{m.title}</p>
                        <span className="text-xs text-stone-500">
                          {formatRelativeDueDate(m.due_date, m.completed)}
                        </span>
                      </div>
                      <p className="mt-0.5 text-xs text-stone-500">
                        Target {formatDisplayDate(m.due_date)}
                      </p>
                      {total > 0 ? (<div className="mt-3 space-y-1">
                          <div className="flex justify-between text-[11px] text-stone-500">
                            <span>
                              {accepted > 0
                            ? `${accepted} signed-off deliverable${accepted === 1 ? "" : "s"}`
                            : `${done}/${total} work items`}
                            </span>
                            {pct != null ? <span>{pct}%</span> : null}
                          </div>
                          {pct != null ? (<div className="h-1 overflow-hidden rounded-full bg-stone-100">
                              <div className="h-full bg-amber-600 transition-all" style={{ width: `${pct}%` }}/>
                            </div>) : null}
                        </div>) : null}
                    </div>
                  </div>
                </li>);
            })}
          </ul>)}
      </section>

      {deliverables.length > 0 ? (<section className="space-y-3">
          <div>
            <h3 className="font-heading text-lg font-semibold text-stone-900">
              Signed-off deliverables
            </h3>
            <p className="mt-1 text-sm text-stone-600">
              Work your project manager has accepted and shared with you.
            </p>
          </div>
          <ul className="divide-y divide-stone-100 rounded-xl border border-stone-200/90 bg-white">
            {deliverables.map((d) => (<li key={d.id} className="px-4 py-3">
                <p className="font-medium text-stone-900">{d.title}</p>
                <div className="mt-1 flex flex-wrap gap-2 text-xs text-stone-500">
                  {d.milestone ? <span>{d.milestone.title}</span> : null}
                  {d.client_visible_at ? (<span>
                      Accepted{" "}
                      {formatDisplayDate(d.client_visible_at.slice(0, 10))}
                    </span>) : null}
                </div>
              </li>))}
          </ul>
        </section>) : null}

      <section className="space-y-3">
        <div>
          <h3 className="font-heading text-lg font-semibold text-stone-900">
            Site updates
          </h3>
          <p className="mt-1 text-sm text-stone-600">
            Photos and videos from the field, approved by your project manager.
          </p>
        </div>
        <ApprovedSiteGallery items={approvedPhotos}/>
      </section>
    </div>);
}
