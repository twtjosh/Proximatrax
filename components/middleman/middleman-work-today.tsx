"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Camera, ChevronRight, Loader2, Play, Send, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { TaskAttachmentIndicator, TaskAttachmentPanel, } from "@/components/dashboard/task-attachment-panel";
import { nextHandoffAction, normalizeBoardStage } from "@/lib/board-workflow";
import { projectBoardPath } from "@/lib/constants";
import { indexAttachmentsByTask, moveTaskToStage, sortWorkTodayTasks, type TaskWithProject, } from "@/lib/work-task-flow";
import { cn } from "@/lib/utils";
import { listTaskAttachmentsForProject } from "@/services/task-attachment-service";
import { listAssignedTasksForUser } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";
export function MiddlemanWorkToday({ viewerId, initialTasks, initialAttachments, }: {
    viewerId: string;
    initialTasks: TaskWithProject[];
    initialAttachments: TaskAttachment[];
}) {
    const router = useRouter();
    const [tasks, setTasks] = React.useState(initialTasks);
    const [attachments, setAttachments] = React.useState<TaskAttachment[]>(initialAttachments);
    const [busyId, setBusyId] = React.useState<string | null>(null);
    const [openId, setOpenId] = React.useState<string | null>(null);
    const attachmentsByTask = React.useMemo(() => indexAttachmentsByTask(attachments), [attachments]);
    const sorted = React.useMemo(() => sortWorkTodayTasks(tasks), [tasks]);
    async function refreshAll() {
        const nextTasks = await listAssignedTasksForUser(viewerId);
        setTasks(nextTasks);
        const projectIds = [...new Set(nextTasks.map((t) => t.project_id))];
        const attachmentLists = await Promise.all(projectIds.map((id) => listTaskAttachmentsForProject(id)));
        setAttachments(attachmentLists.flat());
        router.refresh();
    }
    async function handleAction(task: TaskWithProject) {
        const handoff = nextHandoffAction(task, "middleman", viewerId);
        if (!handoff)
            return;
        setBusyId(task.id);
        try {
            await moveTaskToStage(task, handoff.targetStage, "middleman", viewerId, task.project_id, handoff.variant === "claim" ? { claimAssigneeId: viewerId } : {});
            toast.success(handoff.variant === "submit" ? "Submitted for PM review" : "Work started");
            await refreshAll();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Action failed.");
        }
        finally {
            setBusyId(null);
        }
    }
    if (sorted.length === 0) {
        return (<div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-12 text-center">
        <p className="font-medium text-slate-800">Nothing assigned today</p>
        <p className="mt-1 text-sm text-slate-500">
          When your PM assigns work, it will appear here first.
        </p>
      </div>);
    }
    return (<ul className="space-y-3">
      {sorted.map((task) => {
            const stage = normalizeBoardStage(task.stage);
            const open = openId === task.id;
            const busy = busyId === task.id;
            const taskAttachments = attachmentsByTask.get(task.id) ?? [];
            const handoff = nextHandoffAction(task, "middleman", viewerId);
            const photos = taskAttachments.filter((a) => a.media_kind === "photo").length;
            return (<li key={task.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
            <div className="flex items-stretch">
              <button type="button" onClick={() => setOpenId(open ? null : task.id)} className="min-w-0 flex-1 p-4 text-left">
                <p className="text-[11px] font-medium uppercase tracking-wide text-[#b45309]">
                  {task.project.title}
                </p>
                <p className="mt-1 font-medium leading-snug text-slate-900">
                  {task.title}
                </p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-slate-500">
                  <span className={cn("rounded-md px-2 py-0.5", stage === "in_progress" && "bg-sky-50 text-sky-800", stage === "review" && "bg-amber-50 text-amber-900", stage === "to_do" && "bg-slate-100 text-slate-600")}>
                    {stage === "in_progress"
                    ? "In progress"
                    : stage === "review"
                        ? "Awaiting PM"
                        : "Ready"}
                  </span>
                  <TaskAttachmentIndicator attachments={taskAttachments}/>
                  {task.due_date ? <span>Due {task.due_date}</span> : null}
                </div>
              </button>
              <Link href={projectBoardPath(task.project_id)} className="flex w-12 shrink-0 items-center justify-center border-l border-slate-100 text-slate-400 hover:bg-slate-50 hover:text-[#b45309]" aria-label={`Open ${task.project.title}`}>
                <ChevronRight className="h-5 w-5"/>
              </Link>
            </div>

            {open ? (<div className="border-t border-slate-100 bg-slate-50/50 px-4 pb-4 pt-3">
                {stage !== "review" ? (<TaskAttachmentPanel projectId={task.project_id} taskId={task.id} attachments={taskAttachments} onChange={(items) => setAttachments((prev) => [
                            ...prev.filter((a) => a.task_id !== task.id),
                            ...items,
                        ])} canUpload canDelete compact/>) : (<TaskAttachmentPanel projectId={task.project_id} taskId={task.id} attachments={taskAttachments} onChange={() => { }} canUpload={false} canDelete={false} compact/>)}

                {handoff ? (<Button type="button" disabled={busy} onClick={() => void handleAction(task)} className={cn("mt-3 h-11 w-full rounded-lg", handoff.variant === "submit"
                            ? "bg-[#d97706] text-slate-950 hover:bg-[#ef9b27]"
                            : "bg-[#1e293b] text-white hover:bg-slate-800")}>
                    {busy ? (<Loader2 className="h-4 w-4 animate-spin"/>) : handoff.variant === "submit" ? (<>
                        <Send className="mr-2 h-4 w-4"/>
                        Submit for review
                        {photos === 0 ? " — add a photo first" : ""}
                      </>) : (<>
                        <Play className="mr-2 h-4 w-4"/>
                        Start work
                      </>)}
                  </Button>) : stage === "review" ? (<p className="mt-3 flex items-center justify-center gap-2 text-sm text-amber-800">
                    <Camera className="h-4 w-4"/>
                    Waiting for PM sign-off
                  </p>) : null}
              </div>) : null}
          </li>);
        })}
    </ul>);
}
