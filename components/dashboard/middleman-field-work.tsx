"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Camera, CheckCircle2, Loader2, Play, Send, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskAttachmentIndicator, TaskAttachmentPanel, } from "@/components/dashboard/task-attachment-panel";
import { indexAttachmentsByTask, moveTaskToStage, } from "@/lib/work-task-flow";
import { nextHandoffAction, normalizeBoardStage, taskBlockedReason, type WorkflowGateContext } from "@/lib/board-workflow";
import { toGateTasks } from "@/lib/milestone-task-gates";
import { cn } from "@/lib/utils";
import { listMilestones } from "@/services/project-service";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listTasksForProject, type TaskWithRelations } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";
export type MiddlemanFieldWorkProps = {
    projectId: string;
    viewerId: string;
    initialTasks: TaskWithRelations[];
    initialAttachments: TaskAttachment[];
};
const STAGE_LABEL: Record<string, string> = {
    to_do: "Ready to start",
    backlog: "Ready to start",
    in_progress: "In progress",
    review: "Awaiting PM review",
};
export function MiddlemanFieldWork({ projectId, viewerId, initialTasks, initialAttachments, }: MiddlemanFieldWorkProps) {
    const router = useRouter();
    const [tasks, setTasks] = React.useState(initialTasks);
    const [attachments, setAttachments] = React.useState<TaskAttachment[]>(initialAttachments);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [expandedId, setExpandedId] = React.useState<string | null>(null);
    const [milestones, setMilestones] = React.useState<WorkflowGateContext["milestones"]>([]);
    React.useEffect(() => {
        void listMilestones(projectId).then(setMilestones);
    }, [projectId]);
    const workflowGateContext = React.useMemo((): WorkflowGateContext => ({
        milestones,
        tasks: toGateTasks(tasks),
    }), [milestones, tasks]);
    const attachmentsByTask = React.useMemo(() => indexAttachmentsByTask(attachments), [attachments]);
    const myWork = React.useMemo(() => {
        return tasks
            .filter((t) => t.assigned_to === viewerId &&
            normalizeBoardStage(t.stage) !== "done")
            .sort((a, b) => {
            const rank = (s: string) => s === "in_progress" ? 0 : s === "review" ? 1 : 2;
            const sa = normalizeBoardStage(a.stage);
            const sb = normalizeBoardStage(b.stage);
            return rank(sa) - rank(sb);
        });
    }, [tasks, viewerId]);
    async function refresh() {
        const [nextTasks, nextAttachments] = await Promise.all([
            listTasksForProject(projectId),
            listTaskAttachmentsForProject(projectId),
        ]);
        setTasks(nextTasks);
        setAttachments(nextAttachments);
        router.refresh();
    }
    async function handleAction(task: TaskWithRelations) {
        const handoff = nextHandoffAction(task, "middleman", viewerId);
        if (!handoff)
            return;
        setBusyId(task.id);
        try {
            await moveTaskToStage(task, handoff.targetStage, "middleman", viewerId, projectId, handoff.variant === "claim" ? { claimAssigneeId: viewerId } : {});
            toast.success(handoff.variant === "submit"
                ? "Submitted for PM review"
                : "Work started");
            await refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Action failed.");
        }
        finally {
            setBusyId(null);
        }
    }
    function setAttachmentsForTask(taskId: string, items: TaskAttachment[]) {
        setAttachments((prev) => [
            ...prev.filter((a) => a.task_id !== taskId),
            ...items,
        ]);
    }
    if (myWork.length === 0) {
        return (<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
        <CheckCircle2 className="mx-auto h-10 w-10 text-slate-300"/>
        <p className="mt-3 font-medium text-slate-800">No assigned work right now</p>
        <p className="mt-1 text-sm text-slate-500">
          When your PM assigns tasks to you, they&apos;ll show up here — tap to
          upload photos and mark steps complete.
        </p>
      </div>);
    }
    return (<ul className="space-y-3">
      {myWork.map((task) => {
            const stage = normalizeBoardStage(task.stage);
            const taskAttachments = attachmentsByTask.get(task.id) ?? [];
            const handoff = nextHandoffAction(task, "middleman", viewerId, workflowGateContext);
            const blocked = taskBlockedReason(task, "middleman", workflowGateContext);
            const expanded = expandedId === task.id;
            const busy = busyId === task.id;
            const photoCount = taskAttachments.filter((a) => a.media_kind === "photo").length;
            return (<li key={task.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <button type="button" onClick={() => setExpandedId(expanded ? null : task.id)} className="flex w-full items-start gap-3 p-4 text-left">
              <div className={cn("mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg", stage === "in_progress" && "bg-sky-50 text-sky-700", stage === "review" && "bg-amber-50 text-amber-800", (stage === "to_do") && "bg-slate-100 text-slate-600")}>
                {stage === "review" ? (<Send className="h-5 w-5"/>) : stage === "in_progress" ? (<Camera className="h-5 w-5"/>) : (<Play className="h-5 w-5"/>)}
              </div>
              <div className="min-w-0 flex-1">
                <p className="font-medium leading-snug text-slate-900">{task.title}</p>
                <p className="mt-1 text-xs text-slate-500">{STAGE_LABEL[task.stage] ?? STAGE_LABEL.to_do}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2">
                  <TaskAttachmentIndicator attachments={taskAttachments}/>
                  {task.milestone ? (<span className="rounded-md bg-slate-50 px-2 py-0.5 text-[11px] text-slate-600">
                      {task.milestone.title}
                    </span>) : null}
                  {task.due_date ? (<span className="text-[11px] text-slate-400">Due {task.due_date}</span>) : null}
                </div>
              </div>
            </button>

            {expanded ? (<div className="border-t border-slate-100 bg-slate-50/40 px-4 pb-4 pt-3">
                {task.description ? (<p className="mb-3 text-sm text-slate-600">{task.description}</p>) : null}

                {stage !== "review" ? (<TaskAttachmentPanel projectId={projectId} taskId={task.id} attachments={taskAttachments} onChange={(items) => setAttachmentsForTask(task.id, items)} canUpload canDelete compact/>) : (<TaskAttachmentPanel projectId={projectId} taskId={task.id} attachments={taskAttachments} onChange={() => { }} canUpload={false} canDelete={false} compact/>)}

                {handoff ? (<Button type="button" disabled={busy} onClick={() => void handleAction(task)} className={cn("mt-3 h-11 w-full rounded-lg font-medium", handoff.variant === "submit"
                            ? "bg-[#d97706] text-slate-950 hover:bg-[#ef9b27]"
                            : "bg-[#1e293b] text-white hover:bg-slate-800")}>
                    {busy ? (<Loader2 className="h-4 w-4 animate-spin"/>) : handoff.variant === "submit" ? (<>
                        <Send className="mr-2 h-4 w-4"/>
                        Submit for review
                        {photoCount === 0 ? " (add a photo first)" : ""}
                      </>) : (<>
                        <Play className="mr-2 h-4 w-4"/>
                        Start work
                      </>)}
                  </Button>) : stage === "review" ? (<p className="mt-3 text-center text-sm text-amber-800">
                    Waiting for PM sign-off — you&apos;ll be notified when accepted.
                  </p>) : blocked ? (<p className="mt-3 rounded-lg border border-amber-100 bg-amber-50/80 px-3 py-2 text-center text-sm text-amber-900">
                    {blocked}
                  </p>) : null}
              </div>) : null}
          </li>);
        })}
    </ul>);
}
