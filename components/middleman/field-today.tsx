"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowUpRight, Camera, Check, Film, Hourglass, ImagePlus, Loader2, Paperclip, Play, RotateCcw, Send } from "lucide-react";
import { toast } from "sonner";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { nextHandoffAction, normalizeBoardStage, parseChecklist, type ChecklistItem } from "@/lib/board-workflow";
import { projectBoardPath } from "@/lib/constants";
import { addDays, daysBetween, duePhrase, fieldOrder, formatDate, isoDateIn, plural, relativeDay, relativePast } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import { indexAttachmentsByTask, moveTaskToStage, type TaskWithProject } from "@/lib/work-task-flow";
import { listTaskAttachmentsForProject, publicTaskAttachmentUrl, uploadTaskAttachment } from "@/services/task-attachment-service";
import { listAssignedTasksForUser, updateTask } from "@/services/task-service";
import type { TaskAttachment } from "@/types/database";

const WEEK_DAYS = 7;
const COARSE = "(pointer: coarse)";
const subscribeCoarse = (onChange: () => void) => {
    const mq = window.matchMedia(COARSE);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
};
/** True on phones and tablets, where the camera input opens the rear camera. */
function useTouch() {
    return React.useSyncExternalStore(subscribeCoarse, () => window.matchMedia(COARSE).matches, () => false);
}

/**
 * A middleman's day, built for a phone on site: the one task to work on now,
 * with its checklist, the camera and the next step in reach of a thumb; then
 * the week ahead and the rest of the list. Any task can be brought up front.
 */
export function FieldToday({ viewerId, today, initialTasks, initialAttachments, sentBack }: {
    viewerId: string;
    /** ISO date (Manila). */
    today: string;
    initialTasks: TaskWithProject[];
    initialAttachments: TaskAttachment[];
    /** Tasks the PM returned from review, with when. */
    sentBack: Record<string, string>;
}) {
    const router = useRouter();
    const [tasks, setTasks] = React.useState(initialTasks);
    const [attachments, setAttachments] = React.useState(initialAttachments);
    const [chosen, setChosen] = React.useState<string | null>(null);
    const [busy, setBusy] = React.useState(false);
    const sentBackIds = React.useMemo(() => new Set(Object.keys(sentBack)), [sentBack]);
    const ordered = React.useMemo(() => fieldOrder(tasks, sentBackIds), [tasks, sentBackIds]);
    const byTask = React.useMemo(() => indexAttachmentsByTask(attachments), [attachments]);
    const focus = ordered.find((t) => t.id === chosen) ?? ordered[0];
    const rest = ordered.filter((t) => t.id !== focus?.id);

    function bringUp(id: string) {
        setChosen(id);
        const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
        document.getElementById("field-focus")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
    }

    async function refresh() {
        const next = await listAssignedTasksForUser(viewerId);
        setTasks(next);
        const lists = await Promise.all([...new Set(next.map((t) => t.project_id))].map((id) => listTaskAttachmentsForProject(id)));
        setAttachments(lists.flat());
        router.refresh();
    }

    async function advance(task: TaskWithProject) {
        const handoff = nextHandoffAction(task, "middleman", viewerId);
        if (!handoff)
            return;
        setBusy(true);
        try {
            await moveTaskToStage(task, handoff.targetStage, "middleman", viewerId, task.project_id, handoff.variant === "claim" ? { claimAssigneeId: viewerId } : {});
            toast.success(handoff.variant === "submit" ? "Sent to your project manager for review" : "Started. It's yours now.");
            await refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't go through. Try again.");
        }
        finally {
            setBusy(false);
        }
    }

    async function saveChecklist(task: TaskWithProject, items: ChecklistItem[]) {
        const before = tasks;
        setTasks((list) => list.map((t) => (t.id === task.id ? { ...t, checklist: items } : t)));
        try {
            await updateTask({ id: task.id, checklist: items });
        }
        catch (e) {
            setTasks(before);
            toast.error(e instanceof Error ? e.message : "The checklist didn't save. Try again.");
        }
    }

    if (!focus) {
        return (<div className="materialize mt-8 rounded-[20px] material px-7 py-9" style={stagger(1)}>
          <p className="text-[17px] font-semibold tracking-[-0.016em] text-ink">You&apos;re all caught up</p>
          <p className="mt-2 max-w-sm text-sm leading-relaxed text-ink-secondary">When your project manager assigns you work, it will show up here, ready to start.</p>
        </div>);
    }

    return (<div className="mt-8 grid items-start gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
      <div id="field-focus" className="scroll-mt-4">
        <AnimatePresence mode="popLayout" initial={false}>
          <motion.div key={focus.id} initial={{ opacity: 0, y: 10, filter: "blur(4px)" }} animate={{ opacity: 1, y: 0, filter: "blur(0px)" }} exit={{ opacity: 0, y: -6, filter: "blur(4px)" }} transition={SPRING}>
            <FocusCard task={focus} today={today} viewerId={viewerId} attachments={byTask.get(focus.id) ?? []} sentBackAt={sentBack[focus.id]} busy={busy} onAdvance={() => void advance(focus)} onChecklist={(items) => void saveChecklist(focus, items)} onUploaded={(added) => setAttachments((list) => [...added, ...list])}/>
          </motion.div>
        </AnimatePresence>
      </div>

      <div className="grid gap-5">
        <WeekStrip tasks={ordered} today={today} focusId={focus.id} onPick={bringUp}/>
        {rest.length > 0 ? (<OverviewCard id="queue-heading" title="Also on your list" count={rest.length} className="materialize" style={stagger(4)}>
            <ul className="pb-2">
              {rest.map((t) => <QueueRow key={t.id} task={t} today={today} sentBack={!!sentBack[t.id]} onPick={() => bringUp(t.id)}/>)}
            </ul>
          </OverviewCard>) : null}
      </div>
    </div>);
}

/* ─────────────────────────── Up now ─────────────────────────── */

function StatusChip({ task, sentBackAt, today }: {
    task: TaskWithProject;
    sentBackAt: string | undefined;
    today: string;
}) {
    const stage = normalizeBoardStage(task.stage);
    if (sentBackAt && stage === "in_progress") {
        return (<span className="inline-flex h-7 items-center gap-1.5 rounded-full bg-brand-soft px-3 text-xs font-semibold text-brand">
          <RotateCcw className="size-3.5" aria-hidden/>
          Sent back by your PM · {relativePast(isoDateIn(sentBackAt), today)}
        </span>);
    }
    const map = {
        in_progress: { label: "In progress", tone: "bg-info-soft text-info" },
        to_do: { label: "Up next", tone: "bg-surface-sunken text-ink-secondary" },
        review: { label: "In review", tone: "bg-warning-soft text-warning" },
        done: { label: "Accepted", tone: "bg-success-soft text-success" },
    } as const;
    const s = map[stage];
    return <span className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-semibold", s.tone)}>{s.label}</span>;
}

function DueChip({ due, today }: {
    due: string | null;
    today: string;
}) {
    if (!due)
        return null;
    const late = daysBetween(due, today);
    return (<span className={cn("inline-flex h-7 items-center rounded-full px-3 text-xs font-medium tabular", late > 0 ? "bg-danger-soft text-danger" : late === 0 ? "bg-brand-soft text-brand" : "bg-surface-sunken text-ink-secondary")}>
      {late > 0 ? `${plural(late, "day")} late` : `Due ${duePhrase(due, today)}`}
    </span>);
}

function FocusCard({ task, today, viewerId, attachments, sentBackAt, busy, onAdvance, onChecklist, onUploaded }: {
    task: TaskWithProject;
    today: string;
    viewerId: string;
    attachments: TaskAttachment[];
    sentBackAt: string | undefined;
    busy: boolean;
    onAdvance: () => void;
    onChecklist: (items: ChecklistItem[]) => void;
    onUploaded: (added: TaskAttachment[]) => void;
}) {
    const stage = normalizeBoardStage(task.stage);
    const handoff = nextHandoffAction(task, "middleman", viewerId);
    const checklist = parseChecklist(task.checklist);
    const done = checklist.filter((c) => c.done).length;
    const photos = attachments.filter((a) => a.media_kind === "photo").length;
    const editable = stage !== "review";
    const cameraRef = React.useRef<HTMLInputElement>(null);
    const libraryRef = React.useRef<HTMLInputElement>(null);
    const [uploading, setUploading] = React.useState(false);
    const needsPhoto = handoff?.variant === "submit" && photos === 0;
    const touch = useTouch();
    const PhotoIcon = touch ? Camera : ImagePlus;

    async function upload(files: FileList | null) {
        if (!files?.length)
            return;
        setUploading(true);
        const added: TaskAttachment[] = [];
        try {
            for (const file of Array.from(files))
                added.push(await uploadTaskAttachment(task.project_id, task.id, file));
            onUploaded(added);
            toast.success(added.length === 1 ? "Photo added" : `${added.length} files added`);
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Upload failed. Check your signal and try again.");
        }
        finally {
            setUploading(false);
            if (cameraRef.current)
                cameraRef.current.value = "";
            if (libraryRef.current)
                libraryRef.current.value = "";
        }
    }

    return (<section aria-labelledby="focus-title" className="materialize rounded-[24px] material" style={stagger(1)}>
      <div className="p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <StatusChip task={task} sentBackAt={sentBackAt} today={today}/>
          <DueChip due={task.due_date} today={today}/>
          {task.priority === "high" ? <span className="inline-flex h-7 items-center rounded-full bg-danger-soft px-3 text-xs font-medium text-danger">High priority</span> : null}
        </div>
        <p className="mt-5 text-xs font-medium text-ink-tertiary">{task.project.title}</p>
        <h2 id="focus-title" className="mt-1 text-[1.5rem] leading-tight font-semibold tracking-[-0.025em] text-balance text-ink sm:text-[1.75rem]">{task.title}</h2>
        {task.description ? <p className="mt-3 line-clamp-3 max-w-prose text-[15px] leading-relaxed text-ink-secondary">{task.description}</p> : null}

        {checklist.length > 0 ? (<div className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Checklist</h3>
              <p className="text-xs font-medium text-ink-secondary tabular">{done} of {checklist.length} done</p>
            </div>
            <div className="mt-2 h-1 overflow-hidden rounded-full bg-surface-sunken" aria-hidden>
              <div className="h-full rounded-full bg-copper transition-[width] duration-500 ease-spring" style={{ width: `${(done / checklist.length) * 100}%` }}/>
            </div>
            <ul className="mt-3 grid gap-1">
              {checklist.map((item) => (<li key={item.id}>
                  <button type="button" role="checkbox" aria-checked={item.done} disabled={!editable} onClick={() => onChecklist(checklist.map((c) => (c.id === item.id ? { ...c, done: !c.done } : c)))} className={cn("press flex min-h-12 w-full cursor-pointer items-center gap-3 rounded-2xl px-3 text-left text-[15px] hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent", focusRing)}>
                    <span aria-hidden className={cn("grid size-6 shrink-0 place-items-center rounded-full border-2 transition-colors duration-300 ease-spring", item.done ? "border-copper bg-copper text-white" : "border-line-strong")}>
                      {item.done ? <Check className="size-3.5" strokeWidth={3}/> : null}
                    </span>
                    <span className={cn("transition-colors duration-300", item.done ? "text-ink-tertiary line-through decoration-line-strong" : "text-ink")}>{item.label}</span>
                  </button>
                </li>))}
            </ul>
          </div>) : null}

        {attachments.length > 0 ? (<div className="mt-7">
            <div className="flex items-baseline justify-between gap-3">
              <h3 className="text-sm font-semibold text-ink">Site photos <span className="font-normal text-ink-tertiary tabular">{attachments.length}</span></h3>
              {editable && touch ? (<button type="button" onClick={() => libraryRef.current?.click()} className={cn("rounded-sm text-xs font-medium text-brand hover:underline", focusRing)}>Upload from gallery</button>) : null}
            </div>
            <div className="mt-3 flex gap-2.5 overflow-x-auto pb-1 [scrollbar-width:thin]">
              {attachments.map((a) => <Thumb key={a.id} item={a}/>)}
              {editable ? (<button type="button" disabled={uploading} onClick={() => cameraRef.current?.click()} className={cn("press grid size-20 shrink-0 cursor-pointer place-items-center rounded-2xl border-2 border-dashed border-copper/45 bg-brand-soft/60 text-brand hover:border-copper hover:bg-brand-soft", focusRing)} aria-label={touch ? "Take another site photo" : "Add another file"}>
                  {uploading ? <Loader2 className="size-6 animate-spin" aria-hidden/> : <span className="flex flex-col items-center gap-1 text-[11px] font-semibold"><PhotoIcon className="size-6" aria-hidden/>{touch ? "Take photo" : "Add more"}</span>}
                </button>) : null}
            </div>
          </div>) : null}
        <input ref={cameraRef} type="file" accept={touch ? "image/*" : "image/*,video/*,.pdf"} capture={touch ? "environment" : undefined} multiple={!touch} className="hidden" onChange={(e) => void upload(e.target.files)}/>
        <input ref={libraryRef} type="file" accept="image/*,video/*,.pdf" multiple className="hidden" onChange={(e) => void upload(e.target.files)}/>
      </div>

      {/* The next step stays in reach of a thumb while the card is on screen. */}
      <div className="sticky bottom-0 z-10 rounded-b-[24px] border-t border-line bg-surface/90 p-4 backdrop-blur-md sm:px-7">
        {stage === "review" ? (<p className="flex h-14 items-center justify-center gap-2 rounded-full bg-warning-soft text-[15px] font-medium text-warning">
            <Hourglass className="size-4" aria-hidden/>
            Waiting for your project manager to accept
          </p>) : handoff ? (<button type="button" disabled={busy || uploading} onClick={needsPhoto ? () => cameraRef.current?.click() : onAdvance} className={cn("press flex h-14 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-brand text-base font-semibold text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_10px_24px_-10px_rgb(180_83_9/0.6)] hover:bg-brand-hover disabled:opacity-60", focusRing)}>
            {busy || uploading ? <Loader2 className="size-5 animate-spin" aria-hidden/> : needsPhoto ? <PhotoIcon className="size-5" aria-hidden/> : handoff.variant === "submit" ? <Send className="size-5" aria-hidden/> : <Play className="size-5" aria-hidden/>}
            {uploading ? "Uploading…" : needsPhoto ? (touch ? "Take a photo to submit" : "Add a photo to submit") : handoff.variant === "submit" ? "Submit for review" : "Start work"}
          </button>) : null}
        <Link href={projectBoardPath(task.project_id)} className={cn("mt-2 flex h-9 items-center justify-center gap-1 rounded-full text-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>
          Open board
          <ArrowUpRight className="size-3.5" aria-hidden/>
        </Link>
      </div>
    </section>);
}

function Thumb({ item }: {
    item: TaskAttachment;
}) {
    const url = publicTaskAttachmentUrl(item.storage_path);
    return (<a href={url} target="_blank" rel="noopener noreferrer" className={cn("press relative grid size-20 shrink-0 place-items-center overflow-hidden rounded-2xl bg-surface-sunken text-ink-tertiary", focusRing)} title={item.file_name}>
      {/* eslint-disable-next-line @next/next/no-img-element -- site photos from storage, shown small */}
      {item.media_kind === "photo" ? <img src={url} alt={item.file_name} className="size-full object-cover"/> : item.media_kind === "video" ? <Film className="size-6" aria-hidden/> : <Paperclip className="size-6" aria-hidden/>}
    </a>);
}

/* ─────────────────────────── Week & list ─────────────────────────── */

function WeekStrip({ tasks, today, focusId, onPick }: {
    tasks: TaskWithProject[];
    today: string;
    focusId: string;
    onPick: (id: string) => void;
}) {
    const days = React.useMemo(() => Array.from({ length: WEEK_DAYS }, (_, i) => addDays(today, i)), [today]);
    const due = (iso: string) => tasks.filter((t) => t.due_date === iso);
    const [selected, setSelected] = React.useState(() => days.find((d) => due(d).length > 0) ?? today);
    const items = due(selected);
    const late = tasks.filter((t) => t.due_date && t.due_date < today && normalizeBoardStage(t.stage) !== "review").length;
    const horizon = days[days.length - 1];
    const anyThisWeek = tasks.some((t) => t.due_date && t.due_date >= today && t.due_date <= horizon);
    const later = tasks.filter((t) => t.due_date && t.due_date > horizon).sort((a, b) => a.due_date!.localeCompare(b.due_date!))[0];
    if (!anyThisWeek) {
        return (<OverviewCard id="week-heading" title="Your week" aside={late > 0 ? <span className="font-medium text-danger">{late} overdue</span> : undefined} className="materialize" style={stagger(3)}>
          <div className="px-5 pb-5">
            <p className="text-sm text-ink-secondary">Nothing is due this week.</p>
            {later ? (<button type="button" onClick={() => onPick(later.id)} className={cn("group mt-3 flex w-full cursor-pointer items-center gap-3 rounded-2xl bg-surface-subtle px-4 py-3 text-left transition-colors duration-300 ease-spring hover:bg-surface-sunken", focusRing)}>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm font-medium text-ink group-hover:text-brand">Next due: {later.title}</span>
                  <span className="block truncate text-xs text-ink-tertiary">{later.project.title}</span>
                </span>
                <span className="shrink-0 text-xs font-medium text-ink tabular">{formatDate(later.due_date!, { weekday: "short", month: "short", day: "numeric" })}</span>
              </button>) : null}
          </div>
        </OverviewCard>);
    }

    return (<OverviewCard id="week-heading" title="Your week" aside={late > 0 ? <span className="font-medium text-danger">{late} overdue</span> : undefined} className="materialize" style={stagger(3)}>
      <div role="group" aria-label="Choose a day" className="grid grid-cols-7 gap-0.5 px-3 pt-1">
        {days.map((iso) => {
            const count = due(iso).length;
            const isSelected = iso === selected;
            return (<button key={iso} type="button" aria-pressed={isSelected} aria-label={`${formatDate(iso, { weekday: "long", month: "long", day: "numeric" })}, ${count ? plural(count, "task") : "nothing"} due`} onClick={() => setSelected(iso)} className={cn("press flex cursor-pointer flex-col items-center gap-1 rounded-2xl py-2 hover:bg-surface-sunken", focusRing)}>
                <span className="text-[10px] font-medium text-ink-tertiary">{formatDate(iso, { weekday: "short" })}</span>
                <span className={cn("relative grid size-8 place-items-center rounded-full text-[15px] font-medium tabular", isSelected ? "text-white" : iso === today ? "text-brand" : "text-ink")}>
                  {isSelected ? <motion.span layoutId="field-week-day" transition={SPRING} className={cn("absolute inset-0 rounded-full", iso === today ? "bg-brand" : "bg-ink")} aria-hidden/> : null}
                  <span className="relative">{formatDate(iso, { day: "numeric" })}</span>
                </span>
                <span className="flex h-1.5 gap-0.5" aria-hidden>{Array.from({ length: Math.min(count, 3) }, (_, k) => <span key={k} className="size-1.5 rounded-full bg-copper"/>)}</span>
              </button>);
        })}
      </div>
      <div className="px-5 pt-2 pb-4">
        <p className="text-xs font-semibold text-ink">{relativeDay(selected, today)}</p>
        {items.length === 0 ? <p className="py-1.5 text-sm text-ink-tertiary">Nothing due.</p> : (<ul>
            {items.map((t) => (<li key={t.id}>
                <button type="button" onClick={() => onPick(t.id)} className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-lg py-2 text-left text-sm", focusRing)}>
                  <span className={cn("size-1.5 shrink-0 rounded-full", t.id === focusId ? "bg-copper" : "bg-ink-tertiary")} aria-hidden/>
                  <span className="min-w-0 flex-1 truncate font-medium text-ink">{t.title}</span>
                  <span className="max-w-[45%] shrink-0 truncate text-xs text-ink-tertiary">{t.project.title}</span>
                </button>
              </li>))}
          </ul>)}
      </div>
    </OverviewCard>);
}

function QueueRow({ task, today, sentBack, onPick }: {
    task: TaskWithProject;
    today: string;
    sentBack: boolean;
    onPick: () => void;
}) {
    const stage = normalizeBoardStage(task.stage);
    const dot = sentBack && stage === "in_progress" ? "bg-copper" : stage === "in_progress" ? "bg-stage-progress" : stage === "review" ? "bg-stage-review" : "bg-stage-todo";
    const late = task.due_date ? daysBetween(task.due_date, today) : 0;
    return (<li className="border-t border-line first:border-t-0">
      <button type="button" onClick={onPick} className={cn("group flex min-h-14 w-full cursor-pointer items-center gap-3 px-5 py-2.5 text-left transition-colors duration-300 ease-spring hover:bg-surface-subtle", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
        <span className={cn("size-2 shrink-0 rounded-full", dot)} aria-hidden/>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{task.title}</span>
          <span className="block truncate text-xs text-ink-tertiary">
            {sentBack && stage === "in_progress" ? <span className="font-medium text-brand">Sent back</span> : <span>{TASK_STAGE_TERMS[stage].label}</span>}
            {" · "}{task.project.title}
          </span>
        </span>
        {task.due_date ? <span className={cn("shrink-0 text-xs tabular", late > 0 ? "font-medium text-danger" : late === 0 ? "font-medium text-brand" : "text-ink-tertiary")}>{late > 0 ? `${plural(late, "day")} late` : duePhrase(task.due_date, today)}</span> : null}
      </button>
    </li>);
}
