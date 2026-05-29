"use client";
import Link from "next/link";
import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, ArrowRight, Pencil, Plus, RotateCcw, Stamp, Trash2, } from "lucide-react";
import { MilestoneDeliveryStamp } from "@/components/projects/milestone-delivery-stamp";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { projectBoardPath, projectTimelinePath } from "@/lib/constants";
import { formatDisplayDate, formatRelativeDueDate, getMilestoneStatus, isDateOutsideProjectWindow, MILESTONE_STATUS_LABELS, MILESTONE_SUGGESTIONS, type MilestoneStatus, } from "@/lib/milestone-utils";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { createMilestone, deleteMilestone, updateMilestone, } from "@/services/project-service";
import type { Milestone } from "@/types/database";
import type { UserRole } from "@/types/enums";
type MilestoneEditorProps = {
    projectId: string;
    initialMilestones: Milestone[];
    canEdit: boolean;
    viewerRole: UserRole | null;
    projectStart: string;
    projectEnd: string;
    taskProgressByMilestone: Record<string, {
        total: number;
        done: number;
    }>;
    isArchived?: boolean;
};
function sortByDueDate(items: Milestone[]): Milestone[] {
    return [...items].sort((a, b) => a.due_date.localeCompare(b.due_date));
}
const STATUS_STYLES: Record<MilestoneStatus, string> = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    overdue: "border-red-200 bg-red-50 text-red-800",
    due_soon: "border-amber-200 bg-amber-50 text-amber-900",
    upcoming: "border-slate-200 bg-slate-50 text-slate-600",
};
export function MilestoneEditor({ projectId, initialMilestones, canEdit, viewerRole, projectStart, projectEnd, taskProgressByMilestone, isArchived = false, }: MilestoneEditorProps) {
    const router = useRouter();
    const isClient = viewerRole === "client";
    const [milestones, setMilestones] = useState<Milestone[]>(() => sortByDueDate(initialMilestones));
    const [editingId, setEditingId] = useState<string | null>(null);
    const [editTitle, setEditTitle] = useState("");
    const [editDate, setEditDate] = useState("");
    const [isAdding, setIsAdding] = useState(false);
    const [newTitle, setNewTitle] = useState("");
    const [newDate, setNewDate] = useState("");
    const [busyId, setBusyId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deleteTarget, setDeleteTarget] = useState<Milestone | null>(null);
    const [dateWarning, setDateWarning] = useState<string | null>(null);
    const [justStampedId, setJustStampedId] = useState<string | null>(null);
    useEffect(() => {
        setMilestones(sortByDueDate(initialMilestones));
    }, [initialMilestones]);
    useEffect(() => {
        const date = isAdding ? newDate : editDate;
        if (!date) {
            setDateWarning(null);
            return;
        }
        if (isDateOutsideProjectWindow(date, projectStart, projectEnd)) {
            setDateWarning(`This date falls outside the project window (${formatDisplayDate(projectStart)} – ${formatDisplayDate(projectEnd)}).`);
        }
        else {
            setDateWarning(null);
        }
    }, [editDate, isAdding, newDate, projectEnd, projectStart]);
    const completedCount = milestones.filter((m) => m.completed).length;
    const total = milestones.length;
    const progressPct = total > 0 ? (completedCount / total) * 100 : 0;
    async function handleToggle(m: Milestone, viaStamp = false) {
        if (!canEdit || isArchived)
            return;
        setBusyId(m.id);
        setError(null);
        const previous = milestones;
        const nextCompleted = !m.completed;
        setMilestones((prev) => prev.map((x) => x.id === m.id ? { ...x, completed: nextCompleted } : x));
        if (nextCompleted && viaStamp) {
            setJustStampedId(m.id);
            window.setTimeout(() => setJustStampedId(null), 650);
        }
        try {
            await updateMilestone({ id: m.id, completed: nextCompleted });
            if (nextCompleted) {
                await logActivity({
                    project_id: projectId,
                    action_type: "milestone_completed",
                    details: { milestone_id: m.id, title: m.title },
                });
            }
            router.refresh();
        }
        catch (err) {
            setMilestones(previous);
            setJustStampedId(null);
            setError(err instanceof Error ? err.message : "Failed to update milestone.");
        }
        finally {
            setBusyId(null);
        }
    }
    async function confirmDelete() {
        if (!deleteTarget || !canEdit)
            return;
        const m = deleteTarget;
        setDeleteTarget(null);
        setBusyId(m.id);
        setError(null);
        const previous = milestones;
        setMilestones((prev) => prev.filter((x) => x.id !== m.id));
        try {
            await deleteMilestone(m.id);
            router.refresh();
        }
        catch (err) {
            setMilestones(previous);
            setError(err instanceof Error ? err.message : "Failed to delete milestone.");
        }
        finally {
            setBusyId(null);
        }
    }
    function startEdit(m: Milestone) {
        setEditingId(m.id);
        setEditTitle(m.title);
        setEditDate(m.due_date);
        setError(null);
    }
    function cancelEdit() {
        setEditingId(null);
        setEditTitle("");
        setEditDate("");
    }
    async function saveEdit(m: Milestone) {
        if (!canEdit)
            return;
        if (!editTitle.trim() || !editDate)
            return;
        setBusyId(m.id);
        setError(null);
        try {
            const updated = await updateMilestone({
                id: m.id,
                title: editTitle.trim(),
                due_date: editDate,
            });
            setMilestones((prev) => sortByDueDate(prev.map((x) => (x.id === m.id ? updated : x))));
            setEditingId(null);
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to update milestone.");
        }
        finally {
            setBusyId(null);
        }
    }
    async function handleAdd(event: FormEvent<HTMLFormElement>) {
        event.preventDefault();
        if (!canEdit)
            return;
        if (!newTitle.trim() || !newDate)
            return;
        setError(null);
        try {
            const created = await createMilestone({
                project_id: projectId,
                title: newTitle.trim(),
                due_date: newDate,
            });
            setMilestones((prev) => sortByDueDate([...prev, created]));
            setNewTitle("");
            setNewDate("");
            setIsAdding(false);
            router.refresh();
        }
        catch (err) {
            setError(err instanceof Error ? err.message : "Failed to add milestone.");
        }
    }
    function applySuggestion(title: string) {
        setNewTitle(title);
        setIsAdding(true);
        setError(null);
    }
    return (<section className={cn("border p-5", isClient ? "border-stone-200/90 bg-white" : "border-slate-200 bg-white")}>
      <div className="mb-1 flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className={cn("font-heading text-lg tracking-tight", isClient ? "font-semibold text-stone-900" : "text-slate-950")}>
            {isClient ? "Your project phases" : "Milestones"}
          </h2>
          <p className="mt-1 max-w-xl text-sm text-slate-500">
            {isClient
            ? "Major delivery checkpoints for this engagement."
            : "Phases run in due-date order — linked board tasks unlock the next phase. When every linked task is accepted, the phase stamps itself delivered."}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {total > 0 ? (<Link href={projectTimelinePath(projectId)} className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a4f02] hover:text-[#d97706]">
              View on timeline
              <ArrowRight className="h-3 w-3"/>
            </Link>) : null}
          {canEdit && !isAdding ? (<button type="button" onClick={() => {
                setIsAdding(true);
                setError(null);
            }} className="inline-flex items-center gap-1.5 border border-[#d97706]/30 bg-[#d97706]/10 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.2em] text-[#9a4f02] transition-colors hover:bg-[#d97706]/20">
              <Plus className="h-3 w-3"/>
              Add
            </button>) : null}
        </div>
      </div>

      {total > 0 ? (<div className="mb-1 mt-5 space-y-2">
          <div className="flex gap-1">
            {milestones.map((m) => (<div key={m.id} title={m.title} className={cn("h-2 min-w-0 flex-1 rounded-full transition-all duration-500", m.completed
                    ? "bg-copper shadow-[0_0_0_1px_rgba(217,119,6,0.35)]"
                    : "bg-cool-grey/80")}/>))}
          </div>
          <div className="flex items-center justify-between gap-3">
            <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-muted-ink">
              Phase journey · {completedCount} of {total} delivered
            </p>
            <span className="font-mono text-[11px] tabular-nums text-slate-500">
              {Math.round(progressPct)}%
            </span>
          </div>
        </div>) : null}

      {total === 0 && !isAdding ? (<div className="mt-4 space-y-3">
          <p className="text-sm text-slate-500">
            No milestones defined yet
            {canEdit ? ". Add one below or pick a template." : "."}
          </p>
          {canEdit ? (<div className="flex flex-wrap gap-2">
              {MILESTONE_SUGGESTIONS.map((title) => (<button key={title} type="button" onClick={() => applySuggestion(title)} className="border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs text-slate-700 transition-colors hover:border-[#d97706]/30 hover:bg-[#d97706]/5">
                  {title}
                </button>))}
            </div>) : null}
        </div>) : null}

      <div className="mt-6">
        {milestones.length > 0 ? (<div className="relative pl-1">
            <div className="absolute bottom-4 left-[15px] top-4 w-px bg-linear-to-b from-copper/50 via-cool-grey to-cool-grey/40" aria-hidden/>
            <div className="space-y-4">
              {milestones.map((m, index) => {
                const status = getMilestoneStatus(m);
                const taskProgress = taskProgressByMilestone[m.id];
                const isLast = index === milestones.length - 1;
                const statusLabel = status === "completed" ? "Delivered" : MILESTONE_STATUS_LABELS[status];
                if (editingId === m.id) {
                    return (<div key={m.id} className="relative flex gap-4">
                      <div className="relative z-10 mt-3 h-8 w-8 shrink-0 rounded-full border-2 border-dashed border-copper/40 bg-white" aria-hidden/>
                      <div className="min-w-0 flex-1 grid gap-2 border border-cool-grey bg-surface-spotlight p-3 sm:grid-cols-[1fr_180px_auto]">
                        <Input value={editTitle} onChange={(e) => setEditTitle(e.target.value)} placeholder="Milestone title" className="h-9 rounded-none" autoFocus/>
                        <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)} className="h-9 rounded-none"/>
                        <div className="flex gap-2">
                          <button type="button" onClick={() => saveEdit(m)} disabled={busyId === m.id} className="border border-[#d97706]/40 bg-[#d97706] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-950 hover:bg-[#ef9b27] disabled:opacity-50">
                            Save
                          </button>
                          <button type="button" onClick={cancelEdit} className="border border-slate-200 bg-white px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600 hover:bg-slate-50">
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>);
                }
                return (<div key={m.id} className={cn("relative flex gap-4", !isLast && "pb-1")}>
                    <div className="relative z-10 shrink-0 pt-3">
                      <div className={cn("flex h-8 w-8 items-center justify-center rounded-full border-2 transition-all duration-300", m.completed
                        ? "border-copper bg-copper text-white shadow-[0_0_0_4px_rgba(217,119,6,0.18)]"
                        : status === "overdue"
                            ? "border-error/50 bg-error-soft text-error"
                            : status === "due_soon"
                                ? "border-warning/60 bg-warning-soft text-warning"
                                : "border-copper/35 bg-white text-copper/70", justStampedId === m.id && "milestone-stamp-pop")} aria-hidden>
                        {m.completed ? (<Stamp className="h-3.5 w-3.5" strokeWidth={2.25}/>) : (<span className="font-mono text-[10px] font-semibold tabular-nums">
                            {index + 1}
                          </span>)}
                      </div>
                    </div>

                    <div className={cn("group min-w-0 flex-1 rounded-xl border p-4 transition-colors", m.completed
                        ? "border-emerald-200/80 bg-linear-to-br from-emerald-50/80 to-white"
                        : "border-cool-grey bg-white")}>
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                        <div className="min-w-0 space-y-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <h3 className={cn("font-heading text-[15px] font-semibold leading-snug tracking-tight", m.completed
                        ? "text-emerald-900/80"
                        : "text-ink")}>
                              {m.title}
                            </h3>
                            <span className={cn("shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]", STATUS_STYLES[status])}>
                              {statusLabel}
                            </span>
                          </div>
                        </div>

                        <div className="flex shrink-0 items-start gap-3 sm:flex-col sm:items-end">
                          <div className="text-right">
                            <span className="block font-mono text-[10px] uppercase tracking-[0.18em] text-slate-400">
                              {formatDisplayDate(m.due_date)}
                            </span>
                            <span className={cn("text-[11px]", status === "overdue"
                        ? "text-red-600"
                        : status === "due_soon"
                            ? "text-amber-700"
                            : m.completed
                                ? "text-emerald-700"
                                : "text-slate-500")}>
                              {m.completed
                        ? "Stamped delivered"
                        : formatRelativeDueDate(m.due_date, m.completed)}
                            </span>
                          </div>
                          {canEdit ? (<div className="flex items-center gap-1.5 opacity-100 transition-opacity sm:opacity-0 sm:focus-within:opacity-100 sm:group-hover:opacity-100">
                              <button type="button" onClick={() => startEdit(m)} aria-label={`Edit ${m.title}`} className="p-1 text-slate-400 hover:text-slate-700">
                                <Pencil className="h-3.5 w-3.5"/>
                              </button>
                              <button type="button" onClick={() => setDeleteTarget(m)} disabled={busyId === m.id} aria-label={`Delete ${m.title}`} className="p-1 text-slate-400 hover:text-red-600 disabled:opacity-50">
                                <Trash2 className="h-3.5 w-3.5"/>
                              </button>
                            </div>) : null}
                        </div>
                      </div>

                      {(taskProgress?.total ?? 0) > 0 ||
                        (canEdit && !m.completed) ||
                        (canEdit && m.completed) ||
                        (isClient && m.completed) ? (<div className="mt-3 flex flex-col gap-2.5 border-t border-slate-100 pt-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="flex min-w-0 flex-wrap items-center gap-2">
                            {taskProgress && taskProgress.total > 0 ? (<Link href={projectBoardPath(projectId, {
                                milestone: m.id,
                            })} className="inline-flex items-center gap-1.5 rounded-md bg-slate-50/90 px-2.5 py-1.5 text-xs ring-1 ring-slate-200/80 transition-colors hover:bg-copper-soft/35 hover:ring-copper/25">
                                <span className="font-medium tabular-nums text-slate-700">
                                  {taskProgress.done}/{taskProgress.total}
                                </span>
                                <span className="text-slate-500">linked on board</span>
                                <ArrowRight className="h-3 w-3 shrink-0 text-copper/80"/>
                              </Link>) : null}

                            {canEdit && m.completed ? (<button type="button" onClick={() => void handleToggle(m)} disabled={busyId === m.id} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted-ink transition-colors hover:bg-slate-50 hover:text-charcoal disabled:opacity-50">
                                <RotateCcw className="h-3 w-3"/>
                                Reopen phase
                              </button>) : null}

                            {isClient && m.completed ? (<p className="inline-flex items-center gap-1.5 rounded-md bg-emerald-50/80 px-2 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-emerald-700 ring-1 ring-emerald-200/70">
                                <Stamp className="h-3 w-3"/>
                                Delivered
                              </p>) : null}
                          </div>

                          {canEdit && !m.completed ? (<MilestoneDeliveryStamp variant="compact" disabled={busyId === m.id} onDeliver={() => void handleToggle(m, true)} className="w-full shrink-0 sm:w-auto"/>) : null}
                        </div>) : null}
                    </div>
                  </div>);
            })}
            </div>
          </div>) : null}

        {isAdding ? (<form onSubmit={handleAdd} className="mt-2 grid gap-2 border border-slate-200 bg-slate-50 p-3 sm:grid-cols-[1fr_180px_auto]">
            <Input value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="Milestone title" required autoFocus className="h-9 rounded-none bg-white"/>
            <Input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} required className="h-9 rounded-none bg-white"/>
            <div className="flex gap-2">
              <button type="submit" className="border border-[#d97706]/40 bg-[#d97706] px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-950 hover:bg-[#ef9b27]">
                Save
              </button>
              <button type="button" onClick={() => {
                setIsAdding(false);
                setNewTitle("");
                setNewDate("");
            }} className="border border-slate-200 bg-white px-3 font-mono text-[10px] uppercase tracking-[0.18em] text-slate-600 hover:bg-slate-50">
                Cancel
              </button>
            </div>
          </form>) : null}
      </div>

      {dateWarning ? (<p className="mt-3 flex items-start gap-2 text-xs text-amber-800">
          <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0"/>
          {dateWarning}
        </p>) : null}

      {error ? (<div className="mt-4 flex items-start gap-2 border border-red-200 bg-red-50 p-3 text-sm text-red-800">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>
          <span>{error}</span>
        </div>) : null}

      <Dialog open={deleteTarget !== null} onOpenChange={(open) => {
            if (!open)
                setDeleteTarget(null);
        }}>
        <DialogContent className="rounded-none border-slate-200 sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="font-heading">Delete milestone?</DialogTitle>
            <DialogDescription>
              Remove &ldquo;{deleteTarget?.title}&rdquo; from this project. Linked
              tasks will remain but lose this milestone association. This cannot
              be undone.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" className="rounded-none" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button type="button" className="rounded-none bg-red-600 hover:bg-red-700" onClick={() => void confirmDelete()}>
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>);
}
