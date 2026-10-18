"use client";
import * as React from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import { Camera, Check, CheckCircle2, FileText, Flag, Loader2, Lock, Play, Plus, RotateCcw, Send, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { PhotoViewer } from "@/components/projects/shared/photo-viewer";
import { TaskDiscussion } from "@/components/projects/shared/task-discussion";
import { TaskHistory } from "@/components/projects/shared/task-history";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { normalizeBoardStage, parseChecklist, taskBlockedReason, type BoardColumnStage, type ChecklistItem, type WorkflowGateContext } from "@/lib/board-workflow";
import { projectReviewPath } from "@/lib/constants";
import { formatDate } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { milestoneTaskDates } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { deleteTaskAttachment, publicTaskAttachmentUrl, uploadTaskAttachment } from "@/services/task-attachment-service";
import { deleteTask, updateTask, type TaskWithRelations, type UpdateTaskInput } from "@/services/task-service";
import { notifyWorkReadyAfterProjectTaskChange, snapshotProjectTasksForNotify } from "@/services/work-notification-service";
import type { Milestone, Profile, TaskAttachment } from "@/types/database";
import { COLUMNS, fixReason, isLate } from "./board-meta";

const field = "h-10 w-full rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none disabled:opacity-60";

type Props = {
    task: TaskWithRelations | null;
    projectId: string;
    viewerId: string;
    /** Comments on the open task, for its tab label until the thread loads. */
    commentCount: number;
    onCommentCount: (taskId: string, n: number) => void;
    attachments: TaskAttachment[];
    people: Profile[];
    milestones: Milestone[];
    projectStart: string;
    today: string;
    closed: boolean;
    gate: WorkflowGateContext;
    reduce: boolean;
    onClose: () => void;
    onPatch: (id: string, patch: Partial<TaskWithRelations>) => void;
    onMove: (task: TaskWithRelations, to: BoardColumnStage) => void;
    onFiles: (taskId: string, list: TaskAttachment[]) => void;
    onDeleted: (id: string) => void;
};

/** A task in full, edited in place: every field saves as you leave it. */
export function TaskSheet(props: Props) {
    // Keep the last task while the sheet slides away.
    const [last, setLast] = React.useState(props.task);
    if (props.task && props.task !== last)
        setLast(props.task);
    return (<Sheet open={!!props.task} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className="w-full gap-0 border-line bg-canvas p-0 sm:max-w-lg">
        {last ? <Body key={last.id} {...props} task={last}/> : null}
      </SheetContent>
    </Sheet>);
}

function Body({ task, projectId, viewerId, commentCount, onCommentCount, attachments, people, milestones, projectStart, today, closed, gate, reduce, onPatch, onMove, onFiles, onDeleted }: Props & {
    task: TaskWithRelations;
}) {
    const stage = normalizeBoardStage(task.stage);
    const column = COLUMNS.find((c) => c.stage === stage)!;
    const locked = closed || stage === "done";
    const checklist = parseChecklist(task.checklist);
    const blocked = stage === "to_do" ? taskBlockedReason(task, "project_manager", gate) : null;
    const fix = stage === "in_progress" ? fixReason(task) : null;
    const photos = attachments.filter((a) => a.media_kind === "photo");
    const docs = attachments.filter((a) => a.media_kind !== "photo");
    const [title, setTitle] = React.useState(task.title);
    const [description, setDescription] = React.useState(task.description ?? "");
    const [newItem, setNewItem] = React.useState("");
    const [saved, setSaved] = React.useState(0);
    const [uploading, setUploading] = React.useState(false);
    const [viewer, setViewer] = React.useState<number | null>(null);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [deleting, setDeleting] = React.useState(false);
    const [tab, setTab] = React.useState<"details" | "discussion" | "history">("details");
    const [count, setCount] = React.useState(commentCount);
    const fileRef = React.useRef<HTMLInputElement>(null);

    React.useEffect(() => {
        if (!confirmDelete)
            return;
        const t = window.setTimeout(() => setConfirmDelete(false), 3500);
        return () => window.clearTimeout(t);
    }, [confirmDelete]);

    /** Shows the change at once, saves it, and puts it back if the save fails. */
    async function save(patch: Omit<UpdateTaskInput, "id">, local: Partial<TaskWithRelations> = patch as Partial<TaskWithRelations>, logged = false) {
        const previous = Object.fromEntries(Object.keys(local).map((k) => [k, task[k as keyof TaskWithRelations]])) as Partial<TaskWithRelations>;
        onPatch(task.id, local);
        try {
            const before = "assigned_to" in patch && patch.assigned_to ? await snapshotProjectTasksForNotify(projectId) : null;
            await updateTask({ id: task.id, ...patch });
            setSaved((n) => n + 1);
            if (before)
                void notifyWorkReadyAfterProjectTaskChange(projectId, before);
            if (logged)
                void logActivity({ project_id: projectId, action_type: "task_updated", details: { task_id: task.id, title: task.title } });
        }
        catch (e) {
            onPatch(task.id, previous);
            toast.error(e instanceof Error ? e.message : "That change didn't save.");
        }
    }
    const saveChecklist = (items: ChecklistItem[]) => void save({ checklist: items }, { checklist: items as unknown as TaskWithRelations["checklist"] });

    async function upload(list: FileList | null) {
        if (!list?.length)
            return;
        setUploading(true);
        const added: TaskAttachment[] = [];
        try {
            for (const file of Array.from(list))
                added.push(await uploadTaskAttachment(projectId, task.id, file));
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed.");
        }
        finally {
            if (added.length)
                onFiles(task.id, [...attachments, ...added]);
            setUploading(false);
            if (fileRef.current)
                fileRef.current.value = "";
        }
    }

    async function removeFile(a: TaskAttachment) {
        onFiles(task.id, attachments.filter((x) => x.id !== a.id));
        try {
            await deleteTaskAttachment(a.id, a.storage_path);
        }
        catch (e) {
            onFiles(task.id, attachments);
            toast.error(e instanceof Error ? e.message : "That file couldn't be removed.");
        }
    }

    async function remove() {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setDeleting(true);
        try {
            await deleteTask(task.id);
            toast.success(`Deleted "${task.title}"`);
            onDeleted(task.id);
        }
        catch (e) {
            setDeleting(false);
            toast.error(e instanceof Error ? e.message : "That task couldn't be deleted.");
        }
    }

    return (<>
      <SheetHeader className="gap-3 border-b border-line px-6 pt-6 pb-5">
        <SheetDescription className="flex items-center gap-2 text-xs text-ink-tertiary">
          <span className={cn("size-2 rounded-full", column.dot)} aria-hidden/>
          <span className="font-medium text-ink-secondary">{column.label}</span>
          {task.milestone ? <span className="truncate">· {task.milestone.title}</span> : null}
          <SavedMark n={saved}/>
        </SheetDescription>
        <SheetTitle className="sr-only">{task.title}</SheetTitle>
        <textarea value={title} disabled={locked} rows={1} onChange={(e) => setTitle(e.target.value.replace(/\n/g, ""))} onBlur={() => {
                const next = title.trim();
                if (next && next !== task.title)
                    void save({ title: next }, { title: next }, true);
                else
                    setTitle(task.title);
            }} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Task title" className="field-sizing-content -mx-2 min-h-0 resize-none rounded-xl bg-transparent px-2 py-1 text-[1.35rem] leading-tight font-semibold tracking-[-0.025em] text-ink hover:bg-surface-sunken focus:bg-surface focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none disabled:hover:bg-transparent"/>
        <NextStep task={task} stage={stage} projectId={projectId} closed={closed} onMove={onMove}/>
      </SheetHeader>

      <nav role="tablist" aria-label="Task" className="flex gap-1 border-b border-line px-4">
        {([["details", "Details"], ["discussion", "Discussion"], ["history", "History"]] as const).map(([key, label]) => (<button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => setTab(key)} className={cn("relative inline-flex cursor-pointer items-center gap-1.5 px-2.5 py-3 text-sm font-medium transition-colors duration-300", tab === key ? "text-ink" : "text-ink-tertiary hover:text-ink", focusRing, "focus-visible:ring-offset-0")}>
            {label}
            {key === "discussion" && count > 0 ? <span className="rounded-full bg-surface-sunken px-1.5 text-[11px] font-semibold text-ink-secondary tabular">{count}</span> : null}
            {tab === key ? <motion.span layoutId="task-sheet-tab" transition={SPRING} className="absolute inset-x-1.5 -bottom-px h-0.5 rounded-full bg-copper" aria-hidden/> : null}
          </button>))}
      </nav>

      {tab === "discussion" ? (<div className="flex min-h-0 flex-1 flex-col overflow-y-auto px-6 pt-5 pb-4">
          <TaskDiscussion taskId={task.id} projectId={projectId} taskTitle={task.title} viewerId={viewerId} isPm disabled={closed} onCount={(n) => {
                setCount(n);
                onCommentCount(task.id, n);
            }}/>
        </div>) : tab === "history" ? (<div className="flex-1 overflow-y-auto px-6 py-5"><TaskHistory projectId={projectId} taskId={task.id}/></div>) : (<div className="grid flex-1 grid-cols-[minmax(0,1fr)] content-start gap-6 overflow-y-auto px-6 py-5">
        {fix ? (<p className="flex items-start gap-2 rounded-2xl bg-danger-soft px-3.5 py-3 text-sm text-danger"><RotateCcw className="mt-0.5 size-4 shrink-0" aria-hidden/><span><b className="font-semibold">Sent back:</b> {fix}</span></p>) : null}
        {blocked && blocked !== "Needs owner" ? (<p className="flex items-center gap-2 rounded-2xl bg-warning-soft px-3.5 py-3 text-sm text-warning"><Lock className="size-4 shrink-0" aria-hidden/>{blocked}. You can still start it; you&apos;ll be asked first.</p>) : null}

        <fieldset disabled={locked} className="grid grid-cols-2 gap-3">
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">Who does it
            <select value={task.assigned_to ?? ""} onChange={(e) => {
                const p = people.find((x) => x.id === e.target.value);
                void save({ assigned_to: p?.id ?? null }, { assigned_to: p?.id ?? null, assignee: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null }, true);
            }} className={cn(field, "cursor-pointer")}>
              <option value="">No one yet</option>
              {people.map((p) => <option key={p.id} value={p.id}>{p.full_name}{p.role === "project_manager" ? " (you)" : ""}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">Milestone
            <select value={task.milestone_id ?? ""} onChange={(e) => {
                const m = milestones.find((x) => x.id === e.target.value);
                // Dates follow the new milestone while they are unset or still the old one's default.
                const from = milestones.find((x) => x.id === task.milestone_id);
                const dates = !task.due_date || task.due_date === from?.due_date ? milestoneTaskDates(m?.id ?? null, milestones, projectStart, today) : null;
                void save({ milestone_id: m?.id ?? null, ...dates }, { milestone_id: m?.id ?? null, milestone: m ? { id: m.id, title: m.title } : null, ...dates });
            }} className={cn(field, "cursor-pointer")}>
              <option value="">None</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">Starts
            <input type="date" value={task.start_date ?? ""} max={task.due_date ?? undefined} onChange={(e) => void save({ start_date: e.target.value || null }, { start_date: e.target.value || null })} className={cn(field, "tabular")}/>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">
            <span>Due{isLate(task, today) ? <span className="ml-1.5 font-semibold text-danger">late</span> : null}</span>
            <input type="date" value={task.due_date ?? ""} onChange={(e) => void save({ due_date: e.target.value || null }, { due_date: e.target.value || null }, true)} className={cn(field, "tabular", isLate(task, today) && "border-danger/40 text-danger")}/>
          </label>
          <div className="col-span-2 grid gap-1.5 text-xs font-medium text-ink-secondary">Priority
            <button type="button" role="switch" aria-checked={task.priority === "high"} onClick={() => void save({ priority: task.priority === "high" ? "medium" : "high" })} className={cn("press flex h-10 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm transition-colors duration-300", task.priority === "high" ? "border-stage-late/40 bg-danger-soft font-semibold text-danger" : "border-line bg-surface text-ink-secondary hover:text-ink", focusRing)}>
              <Flag className={cn("size-4", task.priority === "high" && "fill-current")} aria-hidden/>High priority
            </button>
          </div>
        </fieldset>

        <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">Notes for the crew
          <textarea value={description} disabled={locked} onChange={(e) => setDescription(e.target.value)} onBlur={() => {
                if (description.trim() !== (task.description ?? ""))
                    void save({ description: description.trim() || null }, { description: description.trim() || null });
            }} rows={3} placeholder="Materials, measurements, where to start…" className="field-sizing-content min-h-20 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none disabled:opacity-60"/>
        </label>

        <section aria-label="Checklist" className="grid gap-2">
          <h3 className="flex items-center justify-between text-xs font-medium text-ink-secondary">Checklist
            {checklist.length > 0 ? <span className="tabular text-ink-tertiary">{checklist.filter((c) => c.done).length} of {checklist.length}</span> : null}
          </h3>
          <ul className="grid gap-1">
            {checklist.map((c) => (<motion.li key={c.id} layout={!reduce} transition={SPRING} className="group flex items-center gap-2.5 rounded-xl px-1 py-1 hover:bg-surface-sunken">
                <button type="button" role="checkbox" aria-checked={c.done} disabled={locked} onClick={() => saveChecklist(checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)))} className={cn("grid size-5 shrink-0 cursor-pointer place-items-center rounded-md transition-colors duration-300", c.done ? "bg-stage-done text-white" : "border-2 border-line-strong", focusRing)}>
                  {c.done ? <Check className="size-3" strokeWidth={3} aria-hidden/> : null}
                  <span className="sr-only">{c.label}</span>
                </button>
                <span className={cn("min-w-0 flex-1 text-sm", c.done ? "text-ink-tertiary line-through decoration-line-strong" : c.label.startsWith("Fix: ") ? "font-medium text-danger" : "text-ink")}>{c.label}</span>
                {!locked ? <button type="button" aria-label={`Remove ${c.label}`} onClick={() => saveChecklist(checklist.filter((x) => x.id !== c.id))} className={cn("grid size-7 cursor-pointer place-items-center rounded-lg text-ink-tertiary opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100", focusRing)}><X className="size-3.5" aria-hidden/></button> : null}
              </motion.li>))}
          </ul>
          {!locked ? (<form onSubmit={(e) => {
                    e.preventDefault();
                    if (!newItem.trim())
                        return;
                    saveChecklist([...checklist, { id: crypto.randomUUID(), label: newItem.trim(), done: false }]);
                    setNewItem("");
                }} className="flex items-center gap-2.5 px-1">
              <Plus className="size-5 shrink-0 p-0.5 text-ink-tertiary" aria-hidden/>
              <input value={newItem} onChange={(e) => setNewItem(e.target.value)} placeholder="Add a step" aria-label="Add a checklist step" className="h-8 min-w-0 flex-1 bg-transparent text-sm placeholder:text-ink-tertiary focus:outline-none"/>
            </form>) : null}
        </section>

        <section aria-label="Photos and files" className="grid grid-cols-[minmax(0,1fr)] gap-2">
          <h3 className="flex items-center justify-between text-xs font-medium text-ink-secondary">Photos and files
            {!closed ? (<button type="button" disabled={uploading} onClick={() => fileRef.current?.click()} className={cn(softAction, "h-7")}>{uploading ? <Loader2 className="animate-spin" aria-hidden/> : <Camera aria-hidden/>}{uploading ? "Uploading…" : "Add"}</button>) : null}
          </h3>
          <input ref={fileRef} type="file" multiple accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx" className="sr-only" tabIndex={-1} onChange={(e) => void upload(e.target.files)}/>
          {photos.length > 0 ? (<ul className="grid grid-cols-3 gap-2">
              {photos.map((p, i) => (<li key={p.id} className="group relative">
                  <button type="button" onClick={() => setViewer(i)} aria-label={`Open photo ${i + 1}`} className={cn("block aspect-square w-full cursor-zoom-in overflow-hidden rounded-xl bg-surface-sunken", focusRing)}>
                    {/* eslint-disable-next-line @next/next/no-img-element -- site photo thumbnail */}
                    <img src={publicTaskAttachmentUrl(p.storage_path)} alt="" className="size-full object-cover transition-transform duration-500 ease-spring group-hover:scale-[1.04]"/>
                  </button>
                  {p.approved_for_client_at ? <span className="pointer-events-none absolute bottom-1.5 left-1.5 rounded-full bg-surface/90 px-1.5 py-0.5 text-[10px] font-medium text-success">Client sees</span> : null}
                  {!locked ? <button type="button" aria-label={`Remove photo ${i + 1}`} onClick={() => void removeFile(p)} className={cn("absolute top-1.5 right-1.5 grid size-7 cursor-pointer place-items-center rounded-full bg-surface/90 text-ink-secondary opacity-0 transition-opacity group-hover:opacity-100 hover:text-danger focus-visible:opacity-100", focusRing)}><Trash2 className="size-3.5" aria-hidden/></button> : null}
                </li>))}
            </ul>) : null}
          {docs.length > 0 ? (<ul className="grid grid-cols-[minmax(0,1fr)] gap-1">
              {docs.map((d) => (<li key={d.id} className="group flex items-center gap-2 rounded-xl px-1 py-1 hover:bg-surface-sunken">
                  <FileText className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
                  <a href={publicTaskAttachmentUrl(d.storage_path)} target="_blank" rel="noopener noreferrer" className="min-w-0 flex-1 truncate text-sm hover:underline">{d.file_name}</a>
                  {!locked ? <button type="button" aria-label={`Remove ${d.file_name}`} onClick={() => void removeFile(d)} className={cn("grid size-7 cursor-pointer place-items-center rounded-lg text-ink-tertiary opacity-0 group-hover:opacity-100 hover:text-danger focus-visible:opacity-100", focusRing)}><Trash2 className="size-3.5" aria-hidden/></button> : null}
                </li>))}
            </ul>) : null}
          {attachments.length === 0 ? <p className="rounded-2xl border border-dashed border-line px-4 py-5 text-center text-xs text-ink-tertiary">No photos yet. The crew adds them when they submit.</p> : null}
        </section>
      </div>)}

      {!locked && tab === "details" ? (<footer className="border-t border-line px-6 py-3">
          <button type="button" disabled={deleting} onClick={() => void remove()} className={cn("press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-300", confirmDelete ? "bg-danger text-white" : "text-ink-tertiary hover:bg-danger-soft hover:text-danger", focusRing)}>
            {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Trash2 className="size-4" aria-hidden/>}{confirmDelete ? "Click again to delete" : "Delete task"}
          </button>
        </footer>) : null}

      <PhotoViewer photos={photos.map((p, i) => ({ id: p.id, url: publicTaskAttachmentUrl(p.storage_path), caption: `${task.title} · photo ${i + 1}` }))} index={viewer} onIndex={setViewer} onClose={() => setViewer(null)}/>
    </>);
}

/** The one thing to do next with this task, in the PM's hands. */
function NextStep({ task, stage, projectId, closed, onMove }: {
    task: TaskWithRelations;
    stage: BoardColumnStage;
    projectId: string;
    closed: boolean;
    onMove: (task: TaskWithRelations, to: BoardColumnStage) => void;
}) {
    if (closed)
        return null;
    if (stage === "done")
        return (<p className="flex items-center gap-2 text-sm text-success"><CheckCircle2 className="size-4" aria-hidden/>Accepted {formatDate(task.updated_at.slice(0, 10), { month: "short", day: "numeric" })}{task.client_visible_at ? " · the client can see it" : ""}</p>);
    if (stage === "review")
        return <Link href={`${projectReviewPath(projectId)}?task=${task.id}`} className={cn(primaryAction, "w-fit")}><Check aria-hidden/>Review it</Link>;
    if (stage === "in_progress")
        return <button type="button" onClick={() => onMove(task, "review")} className={cn(softAction, "h-10 w-fit px-4 text-sm")}><Send aria-hidden/>Submit for review</button>;
    if (!task.assigned_to)
        return <p className="text-sm text-ink-tertiary">Pick who does it, then start it.</p>;
    return <button type="button" onClick={() => onMove(task, "in_progress")} className={cn(primaryAction, "w-fit")}><Play aria-hidden/>Start work</button>;
}

function SavedMark({ n }: {
    n: number;
}) {
    if (n === 0)
        return null;
    return (<motion.span key={n} initial={{ opacity: 0, y: 3 }} animate={{ opacity: [0, 1, 1, 0], y: 0 }} transition={{ duration: 1.8, times: [0, 0.1, 0.75, 1] }} className="ml-auto inline-flex items-center gap-1 font-medium text-success" aria-live="polite">
      <Check className="size-3" strokeWidth={3} aria-hidden/>Saved
    </motion.span>);
}
