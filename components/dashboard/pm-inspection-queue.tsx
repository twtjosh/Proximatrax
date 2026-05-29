"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, RotateCcw, ShieldCheck, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskAttachmentPanel, TaskAttachmentIndicator, } from "@/components/dashboard/task-attachment-panel";
import { acceptTaskDeliverable, indexAttachmentsByTask, sendTaskBackToActive, } from "@/lib/work-task-flow";
import { cn } from "@/lib/utils";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listTasksForProject, type TaskWithRelations } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";
import { normalizeBoardStage } from "@/lib/board-workflow";
export type PmInspectionQueueProps = {
    projectId: string;
    initialTasks: TaskWithRelations[];
    initialAttachments: TaskAttachment[];
};
export function PmInspectionQueue({ projectId, initialTasks, initialAttachments, }: PmInspectionQueueProps) {
    const router = useRouter();
    const [tasks, setTasks] = React.useState(initialTasks);
    const [attachments, setAttachments] = React.useState<TaskAttachment[]>(initialAttachments);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const attachmentsByTask = React.useMemo(() => indexAttachmentsByTask(attachments), [attachments]);
    const queue = React.useMemo(() => tasks
        .filter((t) => normalizeBoardStage(t.stage) === "review")
        .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime()), [tasks]);
    async function refresh() {
        const [nextTasks, nextAttachments] = await Promise.all([
            listTasksForProject(projectId),
            listTaskAttachmentsForProject(projectId),
        ]);
        setTasks(nextTasks);
        setAttachments(nextAttachments);
        router.refresh();
    }
    async function handleAccept(task: TaskWithRelations) {
        setBusyId(task.id);
        try {
            const result = await acceptTaskDeliverable(task, projectId);
            toast.success(result.milestoneCompleted
                ? `“${task.title}” accepted — “${result.milestoneCompleted}” phase delivered`
                : `“${task.title}” accepted — visible to client`);
            await refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not accept work.");
        }
        finally {
            setBusyId(null);
        }
    }
    async function handleSendBack(task: TaskWithRelations) {
        setBusyId(task.id);
        try {
            await sendTaskBackToActive(task, projectId);
            toast.success(`Sent “${task.title}” back for more work`);
            await refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Could not send back.");
        }
        finally {
            setBusyId(null);
        }
    }
    return (<div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-200/90 bg-slate-50/60 px-4 py-3">
        <p className="text-sm text-slate-600">
          {queue.length === 0
            ? "Nothing waiting — field submissions will land here."
            : `${queue.length} item${queue.length === 1 ? "" : "s"} awaiting your sign-off`}
        </p>
        <span className={cn("inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium tabular-nums", queue.length > 0
            ? "bg-copper-soft/70 text-copper-hover ring-1 ring-copper/25"
            : "bg-white text-slate-500 ring-1 ring-slate-200/80")}>
          <ShieldCheck className="h-3.5 w-3.5" aria-hidden/>
          {queue.length}
        </span>
      </div>

      {queue.length === 0 ? (<div className="rounded-xl border border-dashed border-slate-200 bg-white px-6 py-14 text-center shadow-sm">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 ring-1 ring-emerald-100">
            <ShieldCheck className="h-6 w-6 text-emerald-500" strokeWidth={1.5}/>
          </div>
          <p className="mt-4 font-medium text-slate-800">Inspection queue is clear</p>
          <p className="mt-1 text-sm text-slate-500">
            Submitted work from the field will appear here for your sign-off.
          </p>
        </div>) : (<ul className="space-y-3">
          {queue.map((task) => {
                const taskAttachments = attachmentsByTask.get(task.id) ?? [];
                const busy = busyId === task.id;
                const missingPhotos = taskAttachments.length === 0;
                return (<li key={task.id} className="overflow-hidden rounded-xl border border-slate-200/90 bg-white shadow-sm">
                <div className="border-b border-slate-100 bg-linear-to-r from-copper-soft/25 to-white px-4 py-3">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0 space-y-1.5">
                      <h3 className="font-medium leading-snug text-slate-900">
                        {task.title}
                      </h3>
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                        {task.assignee ? (<span className="rounded-md bg-white/80 px-2 py-0.5 ring-1 ring-slate-200/70">
                            {task.assignee.full_name}
                          </span>) : null}
                        {task.milestone ? (<span className="rounded-md bg-white/80 px-2 py-0.5 ring-1 ring-slate-200/70">
                            {task.milestone.title}
                          </span>) : null}
                        <TaskAttachmentIndicator attachments={taskAttachments}/>
                      </div>
                    </div>
                    <div className="flex shrink-0 flex-wrap gap-2">
                      <Button type="button" variant="outline" disabled={busy} onClick={() => void handleSendBack(task)} className="h-9 rounded-lg border-slate-200 text-xs font-medium text-slate-600">
                        {busy ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<RotateCcw className="mr-1.5 h-3.5 w-3.5"/>)}
                        Send back
                      </Button>
                      <Button type="button" disabled={busy} onClick={() => void handleAccept(task)} className="h-9 rounded-lg border border-emerald-600/20 bg-emerald-600 text-xs font-medium text-white hover:bg-emerald-700">
                        {busy ? (<Loader2 className="h-3.5 w-3.5 animate-spin"/>) : (<CheckCircle2 className="mr-1.5 h-3.5 w-3.5"/>)}
                        Accept for client
                      </Button>
                    </div>
                  </div>
                </div>
                <div className="p-4">
                  {task.description ? (<p className="mb-3 whitespace-pre-wrap text-sm leading-relaxed text-slate-600">
                      {task.description}
                    </p>) : null}
                  {missingPhotos ? (<p className="flex items-center gap-2 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-sm text-amber-900">
                      <Camera className="h-4 w-4 shrink-0"/>
                      No photos attached — consider sending back before accepting.
                    </p>) : (<TaskAttachmentPanel projectId={projectId} taskId={task.id} attachments={taskAttachments} onChange={() => { }} canUpload={false} canDelete={false} compact/>)}
                </div>
              </li>);
            })}
        </ul>)}
    </div>);
}
