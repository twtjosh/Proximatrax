"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ChevronRight, Flag, Keyboard, ListChecks, Loader2, MessageSquare, Paperclip, RotateCcw, SquareCheck, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { checklistProgress, normalizeBoardStage, type BoardColumnStage } from "@/lib/board-workflow";
import { formatDate } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { agendaCounts, agendaGroups, bucketNote, matchesAgendaFilter, relativeDue, type AgendaFilter, type AgendaKey } from "@/lib/task-agenda";
import { cn } from "@/lib/utils";
import { deleteTask, updateTask, type TaskWithRelations, type UpdateTaskInput } from "@/services/task-service";
import type { Milestone, Profile } from "@/types/database";
import { COLUMNS, fixReason } from "./board-meta";

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const MONTH = (iso: string) => formatDate(iso, { month: "short" });
const DAY = (iso: string) => formatDate(iso, { day: "numeric" });
/** Soft pill colours per stage; the dot keeps the board's stage hue. */
const STAGE_PILL: Record<BoardColumnStage, string> = {
    to_do: "bg-surface-sunken text-ink-secondary",
    in_progress: "bg-info-soft text-info",
    review: "bg-warning-soft text-warning",
    done: "bg-success-soft text-success",
};
const TONE: Partial<Record<AgendaKey, string>> = { late: "text-danger", review: "text-warning" };

type Props = {
    tasks: TaskWithRelations[];
    people: Profile[];
    milestones: Milestone[];
    today: string;
    closed: boolean;
    fileCounts: Map<string, number>;
    comments: Record<string, number>;
    onOpen: (task: TaskWithRelations) => void;
    onMove: (task: TaskWithRelations, to: BoardColumnStage) => void;
    onPatch: (id: string, patch: Partial<TaskWithRelations>) => void;
    onRemoved: (ids: string[]) => void;
};

/**
 * Every task as an agenda: late first, then what waits on the PM, then the
 * calendar, with accepted work folded away. The counts on top filter it.
 * Stage, who and when change in place; ticking rows (hover, focus, or Select
 * on touch) brings up a bar that changes them all at once.
 */
export function TaskList({ tasks, people, milestones, today, closed, fileCounts, comments, onOpen, onMove, onPatch, onRemoved }: Props) {
    const router = useRouter();
    const reduce = useReducedMotion();
    const [filter, setFilter] = React.useState<AgendaFilter>(null);
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
    const [selecting, setSelecting] = React.useState(false);
    const [collapsed, setCollapsed] = React.useState<Set<AgendaKey>>(() => new Set(["done"]));
    const [busy, setBusy] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const rowRefs = React.useRef(new Map<string, HTMLDivElement>());

    // A row that left the list (filtered, deleted) can't stay ticked.
    const ids = new Set(tasks.map((t) => t.id));
    const ticked = [...selected].filter((id) => ids.has(id));
    const counts = agendaCounts(tasks, today);
    const shown = tasks.filter((t) => matchesAgendaFilter(t, filter, today));
    const groups = agendaGroups(shown, today);
    const flat = groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.tasks));

    function toggle(id: string) {
        setSelected((s) => {
            const next = new Set(s);
            if (next.has(id))
                next.delete(id);
            else
                next.add(id);
            return next;
        });
    }
    function clearSelection() {
        setSelected(new Set());
        setSelecting(false);
    }

    async function saveOne(task: TaskWithRelations, patch: Omit<UpdateTaskInput, "id">, local: Partial<TaskWithRelations>) {
        const before = Object.fromEntries(Object.keys(local).map((k) => [k, task[k as keyof TaskWithRelations]])) as Partial<TaskWithRelations>;
        onPatch(task.id, local);
        try {
            await updateTask({ id: task.id, ...patch });
            router.refresh();
        }
        catch (e) {
            onPatch(task.id, before);
            toast.error(e instanceof Error ? e.message : "That change didn't save.");
        }
    }

    /** One change to every ticked row; undoable as a whole. */
    async function bulk(patch: Omit<UpdateTaskInput, "id">, local: Partial<TaskWithRelations>, label: string) {
        const rows = tasks.filter((t) => ticked.includes(t.id));
        const before = rows.map((t) => ({ id: t.id, local: Object.fromEntries(Object.keys(local).map((k) => [k, t[k as keyof TaskWithRelations]])) as Partial<TaskWithRelations> }));
        rows.forEach((t) => onPatch(t.id, local));
        setBusy(true);
        try {
            await Promise.all(rows.map((t) => updateTask({ id: t.id, ...patch })));
            toast.success(`${label} · ${rows.length} ${rows.length === 1 ? "task" : "tasks"}`, {
                action: {
                    label: "Undo",
                    onClick: () => {
                        before.forEach((b) => onPatch(b.id, b.local));
                        void Promise.all(before.map((b) => updateTask({ id: b.id, ...(b.local as Omit<UpdateTaskInput, "id">) }))).then(() => router.refresh());
                    },
                },
            });
            clearSelection();
            router.refresh();
        }
        catch (e) {
            before.forEach((b) => onPatch(b.id, b.local));
            toast.error(e instanceof Error ? e.message : "Some changes didn't save.");
        }
        finally {
            setBusy(false);
        }
    }

    async function removeTicked() {
        const rows = tasks.filter((t) => ticked.includes(t.id));
        if (!confirmDelete) {
            setConfirmDelete(true);
            window.setTimeout(() => setConfirmDelete(false), 3500);
            return;
        }
        setConfirmDelete(false);
        setBusy(true);
        try {
            await Promise.all(rows.map((t) => deleteTask(t.id)));
            onRemoved(rows.map((t) => t.id));
            clearSelection();
            toast.success(`Deleted ${rows.length} ${rows.length === 1 ? "task" : "tasks"}`);
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Some tasks couldn't be deleted.");
            router.refresh();
        }
        finally {
            setBusy(false);
        }
    }

    function onRowKey(e: React.KeyboardEvent, task: TaskWithRelations) {
        if (e.target !== e.currentTarget)
            return;
        const i = flat.findIndex((t) => t.id === task.id);
        const go = (to: number) => rowRefs.current.get(flat[to]?.id ?? "")?.focus();
        if (e.key === "j" || e.key === "ArrowDown")
            go(i + 1);
        else if (e.key === "k" || e.key === "ArrowUp")
            go(i - 1);
        else if (e.key === "x" || e.key === " ")
            toggle(task.id);
        else if (e.key === "Enter")
            onOpen(task);
        else if (e.key === "Escape" && ticked.length)
            clearSelection();
        else
            return;
        e.preventDefault();
    }

    const chips: { key: Exclude<AgendaFilter, null>; n: number; label: string; tone?: string }[] = [
        { key: "late", n: counts.late, label: "late", tone: "text-danger" },
        { key: "review", n: counts.review, label: "waiting for your review", tone: "text-warning" },
        { key: "week", n: counts.week, label: "due this week" },
        { key: "unassigned", n: counts.unassigned, label: "with no one" },
    ];
    const showChecks = selecting || ticked.length > 0;

    return (<div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show only" className="flex flex-wrap gap-2">
          {chips.filter((c) => c.n > 0 || filter === c.key).map((c) => {
              const on = filter === c.key;
              return (<button key={c.key} type="button" aria-pressed={on} onClick={() => setFilter(on ? null : c.key)} className={cn("press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", on ? "bg-ink text-white" : "bg-surface text-ink-secondary shadow-card ring-1 ring-line hover:ring-line-strong", focusRing)}>
                <b className={cn("font-bold tabular", on ? "text-white" : (c.tone ?? "text-ink"))}>{c.n}</b>{c.label}
                {on ? <X className="size-3.5 opacity-70" aria-hidden/> : null}
              </button>);
          })}
        </div>
        <div className="ml-auto flex items-center gap-2">
          {closed ? null : (<button type="button" aria-pressed={showChecks} onClick={() => (showChecks ? clearSelection() : setSelecting(true))} className={cn("press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-[13px] font-medium", showChecks ? "bg-ink text-white" : "bg-surface-sunken text-ink hover:bg-line", focusRing)}>
              <SquareCheck className="size-4" aria-hidden/>{showChecks ? "Done selecting" : "Select"}
            </button>)}
          <DropdownMenu>
            <DropdownMenuTrigger aria-label="Keyboard shortcuts" className={cn("grid size-9 cursor-pointer place-items-center rounded-full bg-surface-sunken text-ink-secondary hover:bg-line max-md:hidden", focusRing)}>
              <Keyboard className="size-4" aria-hidden/>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-60 p-3 text-[12.5px] text-ink-secondary">
              {[["Move between tasks", "J  K"], ["Select a task", "X"], ["Open a task", "Enter"], ["Clear the selection", "Esc"]].map(([what, keys]) => (<div key={what} className="flex items-center justify-between py-1">
                  {what}
                  <span className="flex gap-1">{keys.split("  ").map((k) => <kbd key={k} className="rounded border border-line-strong px-1.5 font-sans text-[11px] font-semibold text-ink shadow-[inset_0_-1px_0_var(--color-line-strong)]">{k}</kbd>)}</span>
                </div>))}
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>

      {groups.length === 0 ? (<p className="materialize rounded-[22px] px-6 py-10 text-center text-sm text-ink-tertiary material">
          {tasks.length === 0 ? "No tasks match. Add one above, or clear the filters." : "Nothing here right now."}
        </p>) : groups.map((g) => {
          const open = !collapsed.has(g.key);
          return (<section key={g.key} aria-labelledby={`agenda-${g.key}`} className="materialize overflow-clip rounded-[22px] material">
            <button type="button" id={`agenda-${g.key}`} aria-expanded={open} onClick={() => setCollapsed((c) => {
                const next = new Set(c);
                if (open)
                    next.add(g.key);
                else
                    next.delete(g.key);
                return next;
            })} className={cn("flex w-full cursor-pointer items-center gap-2 px-5 py-3.5 text-left", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
              <ChevronRight className={cn("size-4 text-ink-tertiary transition-transform duration-300 ease-spring", open && "rotate-90")} aria-hidden/>
              <span className={cn("text-[13.5px] font-semibold", TONE[g.key] ?? "text-ink")}>{g.label}</span>
              <span className="truncate text-xs text-ink-tertiary"><span className="tabular">{g.tasks.length}</span> {g.tasks.length === 1 ? "task" : "tasks"} · {bucketNote(g.key, today)}</span>
            </button>
            {open ? (<div role="list">
                {g.tasks.map((t) => {
                    const stage = normalizeBoardStage(t.stage);
                    const col = COLUMNS.find((c) => c.stage === stage)!;
                    const late = g.key === "late";
                    const fix = stage === "in_progress" ? fixReason(t) : null;
                    const steps = checklistProgress(t.checklist);
                    const on = selected.has(t.id);
                    const locked = closed || stage === "done";
                    return (<motion.div key={t.id} role="listitem" ref={(el) => {
                            if (el)
                                rowRefs.current.set(t.id, el);
                            else
                                rowRefs.current.delete(t.id);
                        }} layout={reduce ? false : "position"} transition={SPRING} tabIndex={0} onKeyDown={(e) => onRowKey(e, t)} className={cn("group grid items-center", showChecks && !closed ? "grid-cols-[auto_auto_minmax(0,1fr)]" : "grid-cols-[auto_minmax(0,1fr)]", " gap-x-3.5 border-t border-line px-5 py-2.5 outline-none transition-colors duration-200 sm:grid-cols-[auto_auto_minmax(0,1fr)_auto] focus-visible:bg-brand-soft/40", on ? "bg-brand-soft/50" : "hover:bg-surface-subtle")}>
                      <span className={cn((closed || !showChecks) && "max-sm:hidden", !closed && !showChecks && "opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100")}>
                        {closed ? <span className="block w-5"/> : <Check on={on} label={`Select ${t.title}`} onClick={() => toggle(t.id)}/>}
                      </span>

                      <label className={cn("relative grid size-12 shrink-0 place-content-center rounded-[13px] text-center leading-none", late ? "bg-danger-soft text-danger" : "bg-surface-subtle text-ink ring-1 ring-line ring-inset", !locked && "cursor-pointer hover:ring-line-strong")}>
                        {t.due_date ? (<>
                            <span className={cn("text-[10px] font-semibold tracking-[0.04em] uppercase", late ? "text-danger" : "text-ink-tertiary")}>{MONTH(t.due_date)}</span>
                            <span className="mt-0.5 text-lg font-semibold tracking-[-0.02em] tabular">{DAY(t.due_date)}</span>
                          </>) : <span className="px-1 text-[10.5px] font-medium text-ink-tertiary">No date</span>}
                        <input type="date" disabled={locked} value={t.due_date ?? ""} aria-label={`Due date for ${t.title}${t.due_date ? `, ${short(t.due_date)}` : ""}`} onChange={(e) => void saveOne(t, { due_date: e.target.value || null }, { due_date: e.target.value || null })} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"/>
                      </label>

                      <button type="button" tabIndex={-1} onClick={() => onOpen(t)} className="min-w-0 cursor-pointer text-left">
                        <span className="flex min-w-0 items-center gap-1.5">
                          {t.priority === "high" ? <Flag className="size-3.5 shrink-0 fill-stage-late text-stage-late" aria-label="High priority"/> : null}
                          <span className={cn("truncate text-[14.5px] font-medium group-hover:underline", stage === "done" ? "text-ink-tertiary" : "text-ink")}>{t.title}</span>
                          {fix ? <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-2 py-px text-[11px] font-semibold text-danger"><RotateCcw className="size-3" aria-hidden/>Sent back</span> : null}
                        </span>
                        <span className="mt-1 flex min-w-0 flex-wrap items-center gap-x-2 gap-y-0.5 text-[12.5px] text-ink-tertiary">
                          {t.milestone ? <span className="inline-flex items-center gap-1.5 text-ink-secondary"><span className="size-2 rotate-45 rounded-[2px] bg-copper" aria-hidden/>{t.milestone.title}</span> : <span>No milestone</span>}
                          <span aria-hidden>·</span>
                          <span className={cn(late && "font-medium text-danger")}>{relativeDue(t.due_date, stage, today)}</span>
                          {fix ? <span className="truncate text-danger">· Fix: {fix}</span> : null}
                          <span className="inline-flex items-center gap-1 sm:hidden"><span className={cn("size-1.5 rounded-full", col.dot)} aria-hidden/>{col.label}{t.assignee ? ` · ${t.assignee.full_name.split(" ")[0]}` : ""}</span>
                        </span>
                      </button>

                      <span className="flex items-center gap-3 max-sm:hidden">
                        <span className="flex items-center gap-2.5 text-xs text-ink-tertiary tabular max-lg:hidden">
                          {steps.total > 0 ? <span className={cn("inline-flex items-center gap-0.5", steps.done === steps.total && "text-success")} title="Checklist"><ListChecks className="size-3.5" aria-hidden/>{steps.done}/{steps.total}</span> : null}
                          {comments[t.id] ? <span className="inline-flex items-center gap-0.5" title="Comments"><MessageSquare className="size-3" aria-hidden/>{comments[t.id]}</span> : null}
                          {fileCounts.get(t.id) ? <span className="inline-flex items-center gap-0.5" title="Files"><Paperclip className="size-3" aria-hidden/>{fileCounts.get(t.id)}</span> : null}
                        </span>
                        <DropdownMenu>
                          <DropdownMenuTrigger disabled={closed} aria-label={`Stage of ${t.title}: ${col.label}`} className={cn("inline-flex h-7 w-[7.5rem] cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium disabled:cursor-default", STAGE_PILL[stage], focusRing)}>
                            <span className={cn("size-2 rounded-full", col.dot)} aria-hidden/>{col.label}
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="min-w-44">
                            {COLUMNS.map((c) => <DropdownMenuItem key={c.stage} disabled={c.stage === stage} onClick={() => onMove(t, c.stage)}><span className={cn("size-2 rounded-full", c.dot)} aria-hidden/>{c.label}</DropdownMenuItem>)}
                          </DropdownMenuContent>
                        </DropdownMenu>
                        <DropdownMenu>
                          <DropdownMenuTrigger disabled={locked} aria-label={`Who does ${t.title}: ${t.assignee?.full_name ?? "no one"}`} className={cn("inline-flex h-8 w-40 cursor-pointer items-center gap-2 rounded-full pr-2.5 pl-1 text-[13px] hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent max-md:w-auto", focusRing)}>
                            {t.assignee ? <Face person={{ id: t.assignee.id, name: t.assignee.full_name, avatarUrl: t.assignee.avatar_url, role: "" }} size={24}/> : <span className="grid size-6 shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-tertiary"><UserRound className="size-3" aria-hidden/></span>}
                            <span className={cn("truncate max-md:hidden", t.assignee ? "text-ink" : "text-ink-tertiary")}>{t.assignee?.full_name ?? "No one yet"}</span>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end" className="max-h-72 min-w-48 overflow-y-auto">
                            {people.map((p) => <DropdownMenuItem key={p.id} disabled={p.id === t.assigned_to} onClick={() => void saveOne(t, { assigned_to: p.id }, { assigned_to: p.id, assignee: { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } })}>{p.full_name}</DropdownMenuItem>)}
                            <DropdownMenuSeparator/>
                            <DropdownMenuItem disabled={!t.assigned_to} onClick={() => void saveOne(t, { assigned_to: null }, { assigned_to: null, assignee: null })}>No one</DropdownMenuItem>
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </span>
                    </motion.div>);
                })}
              </div>) : null}
          </section>);
      })}

      <AnimatePresence>
        {ticked.length > 0 ? (<motion.div role="toolbar" aria-label="Change selected tasks" initial={{ y: 24, opacity: 0, scale: 0.96 }} animate={{ y: 0, opacity: 1, scale: 1 }} exit={{ y: 16, opacity: 0, transition: { duration: 0.15 } }} transition={SPRING} className="fixed inset-x-0 bottom-5 z-30 mx-auto flex w-fit max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-2xl bg-ink p-1.5 pl-4 text-sm text-white shadow-[0_24px_48px_-16px_rgb(14_18_34/0.55)]">
            <span className="mr-2 shrink-0 font-semibold tabular">{ticked.length} selected</span>
            {closed ? null : (<>
                <BulkMenu label="Assign" disabled={busy}>
                  {people.map((p) => <DropdownMenuItem key={p.id} onClick={() => void bulk({ assigned_to: p.id }, { assigned_to: p.id, assignee: { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } }, `Given to ${p.full_name.split(" ")[0]}`)}>{p.full_name}</DropdownMenuItem>)}
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem onClick={() => void bulk({ assigned_to: null }, { assigned_to: null, assignee: null }, "Unassigned")}>No one</DropdownMenuItem>
                </BulkMenu>
                <BulkMenu label="Milestone" disabled={busy}>
                  {milestones.map((m) => <DropdownMenuItem key={m.id} onClick={() => void bulk({ milestone_id: m.id }, { milestone_id: m.id, milestone: { id: m.id, title: m.title } }, `Moved to ${m.title}`)}>{m.title}</DropdownMenuItem>)}
                  <DropdownMenuSeparator/>
                  <DropdownMenuItem onClick={() => void bulk({ milestone_id: null }, { milestone_id: null, milestone: null }, "Out of milestones")}>None</DropdownMenuItem>
                </BulkMenu>
                <label className="relative inline-flex h-8 shrink-0 cursor-pointer items-center rounded-xl px-3 font-medium hover:bg-white/10">
                  Due date
                  <input type="date" disabled={busy} aria-label="Due date for the selected tasks" onChange={(e) => e.target.value && void bulk({ due_date: e.target.value }, { due_date: e.target.value }, `Due ${short(e.target.value)}`)} className="absolute inset-0 cursor-pointer opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full"/>
                </label>
                <BulkMenu label="Priority" disabled={busy}>
                  <DropdownMenuItem onClick={() => void bulk({ priority: "high" }, { priority: "high" }, "Marked high priority")}><Flag className="fill-stage-late text-stage-late" aria-hidden/>High</DropdownMenuItem>
                  <DropdownMenuItem onClick={() => void bulk({ priority: "medium" }, { priority: "medium" }, "Normal priority")}>Normal</DropdownMenuItem>
                </BulkMenu>
                <button type="button" disabled={busy} onClick={() => void removeTicked()} className={cn("inline-flex h-8 shrink-0 cursor-pointer items-center gap-1.5 rounded-xl px-3 font-medium transition-colors duration-200", confirmDelete ? "bg-danger text-white" : "text-[#ff9c9c] hover:bg-white/10")}><Trash2 className="size-4" aria-hidden/>{confirmDelete ? `Delete ${ticked.length}?` : "Delete"}</button>
              </>)}
            {busy ? <Loader2 className="mx-1 size-4 animate-spin" aria-hidden/> : null}
            <button type="button" onClick={clearSelection} aria-label="Clear selection" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-white/10"><X className="size-4" aria-hidden/></button>
          </motion.div>) : null}
      </AnimatePresence>
    </div>);
}

function Check({ on, label, onClick }: {
    on: boolean;
    label: string;
    onClick: () => void;
}) {
    return (<button type="button" role="checkbox" aria-checked={on} aria-label={label} tabIndex={-1} onClick={onClick} className={cn("grid size-5 cursor-pointer place-items-center rounded-[6px] transition-colors duration-200", on ? "bg-brand text-white" : "border-[1.5px] border-line-strong bg-surface hover:border-ink-tertiary", focusRing)}>
      {on ? <svg viewBox="0 0 12 12" className="size-3" aria-hidden><path d="M2.5 6.2 5 8.5l4.5-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/></svg> : null}
    </button>);
}

function BulkMenu({ label, disabled, children }: {
    label: string;
    disabled: boolean;
    children: React.ReactNode;
}) {
    return (<DropdownMenu>
      <DropdownMenuTrigger disabled={disabled} className="inline-flex h-8 shrink-0 cursor-pointer items-center rounded-xl px-3 font-medium hover:bg-white/10 disabled:opacity-50">{label}</DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="center" className="max-h-72 min-w-48 overflow-y-auto">{children}</DropdownMenuContent>
    </DropdownMenu>);
}
