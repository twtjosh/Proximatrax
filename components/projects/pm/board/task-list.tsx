"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowDown, ArrowUp, CalendarDays, ChevronRight, Flag, Loader2, MessageSquare, Paperclip, RotateCcw, Trash2, UserRound, X } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { checklistProgress, normalizeBoardStage, type BoardColumnStage } from "@/lib/board-workflow";
import { daysBetween, formatDate } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { deleteTask, updateTask, type TaskWithRelations, type UpdateTaskInput } from "@/services/task-service";
import type { Milestone, Profile } from "@/types/database";
import { COLUMNS, fixReason, isLate } from "./board-meta";

export type GroupBy = "milestone" | "person" | "stage" | "none";
type SortKey = "due" | "title" | "stage" | "person";
const GROUPS: { key: GroupBy; label: string }[] = [
    { key: "milestone", label: "Milestone" },
    { key: "person", label: "Person" },
    { key: "stage", label: "Stage" },
    { key: "none", label: "None" },
];
const STAGE_ORDER: Record<BoardColumnStage, number> = { to_do: 0, in_progress: 1, review: 2, done: 3 };
const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

type Props = {
    tasks: TaskWithRelations[];
    people: Profile[];
    milestones: Milestone[];
    today: string;
    closed: boolean;
    group: GroupBy;
    onGroup: (g: GroupBy) => void;
    fileCounts: Map<string, number>;
    comments: Record<string, number>;
    onOpen: (task: TaskWithRelations) => void;
    onMove: (task: TaskWithRelations, to: BoardColumnStage) => void;
    onPatch: (id: string, patch: Partial<TaskWithRelations>) => void;
    onRemoved: (ids: string[]) => void;
};

/**
 * Every task as a row, grouped (by milestone unless chosen otherwise) and
 * sortable. Who, when and stage change in place; ticking rows brings up a bar
 * that changes them all at once. Keys: J/K move, X ticks, Enter opens.
 */
export function TaskList({ tasks, people, milestones, today, closed, group, onGroup, fileCounts, comments, onOpen, onMove, onPatch, onRemoved }: Props) {
    const router = useRouter();
    const reduce = useReducedMotion();
    const [sort, setSort] = React.useState<{ key: SortKey; dir: 1 | -1 }>({ key: "due", dir: 1 });
    const [selected, setSelected] = React.useState<Set<string>>(() => new Set());
    const [collapsed, setCollapsed] = React.useState<Set<string>>(() => new Set());
    const [busy, setBusy] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const rowRefs = React.useRef(new Map<string, HTMLTableRowElement>());
    const name = (id: string | null) => people.find((p) => p.id === id)?.full_name ?? "No one";

    // A row that left the list (filtered, deleted) can't stay ticked.
    const ids = new Set(tasks.map((t) => t.id));
    const ticked = [...selected].filter((id) => ids.has(id));

    const sorted = [...tasks].sort((a, b) => {
        const by = sort.key === "title" ? a.title.localeCompare(b.title)
            : sort.key === "stage" ? STAGE_ORDER[normalizeBoardStage(a.stage)] - STAGE_ORDER[normalizeBoardStage(b.stage)]
                : sort.key === "person" ? name(a.assigned_to).localeCompare(name(b.assigned_to))
                    : (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999");
        return by * sort.dir || a.position - b.position;
    });
    const groups = groupTasks(sorted, group, milestones, people);
    const flat = groups.flatMap((g) => (collapsed.has(g.key) ? [] : g.tasks));

    function toggle(id: string, on?: boolean) {
        setSelected((s) => {
            const next = new Set(s);
            if (on ?? !next.has(id))
                next.add(id);
            else
                next.delete(id);
            return next;
        });
    }
    function sortBy(key: SortKey) {
        setSort((s) => (s.key === key ? { key, dir: s.dir === 1 ? -1 : 1 } : { key, dir: 1 }));
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
            setSelected(new Set());
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
            setSelected(new Set());
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
            setSelected(new Set());
        else
            return;
        e.preventDefault();
    }

    const crew = people;
    const allTicked = flat.length > 0 && flat.every((t) => selected.has(t.id));

    return (<div className="grid gap-3">
      <div className="flex items-center gap-2 text-xs text-ink-tertiary">
        <span>Group by</span>
        <div role="radiogroup" aria-label="Group by" className="flex rounded-full bg-surface-sunken p-0.5">
          {GROUPS.map((g) => (<button key={g.key} type="button" role="radio" aria-checked={group === g.key} onClick={() => onGroup(g.key)} className={cn("relative isolate h-7 cursor-pointer rounded-full px-3 font-medium transition-colors duration-300", group === g.key ? "text-ink" : "hover:text-ink", focusRing)}>
              {group === g.key ? <motion.span layoutId="group-pick" transition={SPRING} className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card"/> : null}
              {g.label}
            </button>))}
        </div>
        <span className="ml-auto max-md:hidden"><kbd className="rounded bg-surface-sunken px-1 font-sans font-semibold">J</kbd> <kbd className="rounded bg-surface-sunken px-1 font-sans font-semibold">K</kbd> move · <kbd className="rounded bg-surface-sunken px-1 font-sans font-semibold">X</kbd> select · <kbd className="rounded bg-surface-sunken px-1 font-sans font-semibold">Enter</kbd> open</span>
      </div>

      <div className="materialize overflow-hidden rounded-[22px] material">
        <table className="w-full table-fixed border-collapse text-sm">
          <thead className="sticky top-[var(--frame-stick,0px)] z-10 bg-surface/95 backdrop-blur-xl">
            <tr className="border-b border-line text-left text-xs text-ink-tertiary">
              <th className="w-11 py-2.5 pl-4">
                <Check on={allTicked} label="Select every task shown" onClick={() => setSelected(allTicked ? new Set() : new Set(flat.map((t) => t.id)))}/>
              </th>
              <Th label="Task" k="title" sort={sort} onSort={sortBy}/>
              <Th label="Stage" k="stage" sort={sort} onSort={sortBy} className="w-36 max-sm:hidden"/>
              <Th label="Who" k="person" sort={sort} onSort={sortBy} className="w-44 max-md:hidden"/>
              <Th label="Due" k="due" sort={sort} onSort={sortBy} className="w-32"/>
              <th className="w-28 pr-4 font-medium max-lg:hidden"><span className="sr-only">Progress</span></th>
            </tr>
          </thead>
          {groups.map((g) => {
            const open = !collapsed.has(g.key);
            const done = g.tasks.filter((t) => t.stage === "done").length;
            return (<tbody key={g.key}>
                {group !== "none" ? (<tr className="border-b border-line bg-surface-subtle">
                    <td colSpan={6} className="p-0">
                      <button type="button" onClick={() => setCollapsed((c) => {
                        const next = new Set(c);
                        if (open)
                            next.add(g.key);
                        else
                            next.delete(g.key);
                        return next;
                    })} aria-expanded={open} className={cn("flex w-full cursor-pointer items-center gap-2.5 px-4 py-2 text-left", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
                        <ChevronRight className={cn("size-4 text-ink-tertiary transition-transform duration-300 ease-spring", open && "rotate-90")} aria-hidden/>
                        {g.dot ? <span className={cn("size-2 rounded-full", g.dot)} aria-hidden/> : null}
                        <span className="truncate text-[13px] font-semibold text-ink">{g.label}</span>
                        <span className="text-xs text-ink-tertiary tabular">{g.tasks.length}</span>
                        {g.tasks.length > 0 ? (<span className="ml-auto flex items-center gap-2 text-xs text-ink-tertiary tabular">
                            <span className="h-1 w-16 overflow-hidden rounded-full bg-line max-sm:hidden"><span className="block h-full rounded-full bg-stage-done" style={{ width: `${(done / g.tasks.length) * 100}%` }}/></span>
                            {done}/{g.tasks.length}
                          </span>) : null}
                      </button>
                    </td>
                  </tr>) : null}
                {open ? g.tasks.map((t) => {
                    const stage = normalizeBoardStage(t.stage);
                    const col = COLUMNS.find((c) => c.stage === stage)!;
                    const late = isLate(t, today);
                    const fix = stage === "in_progress" ? fixReason(t) : null;
                    const steps = checklistProgress(t.checklist);
                    const on = selected.has(t.id);
                    const locked = closed || stage === "done";
                    return (<motion.tr key={t.id} ref={(el) => {
                            if (el)
                                rowRefs.current.set(t.id, el);
                            else
                                rowRefs.current.delete(t.id);
                        }} layout={reduce ? false : "position"} transition={SPRING} tabIndex={0} onKeyDown={(e) => onRowKey(e, t)} aria-selected={on} className={cn("group border-b border-line last:border-b-0 transition-colors duration-200 outline-none focus-visible:bg-brand-soft/40", on ? "bg-brand-soft/50" : "hover:bg-surface-subtle")}>
                        <td className="py-2 pl-4 align-middle"><Check on={on} label={`Select ${t.title}`} onClick={() => toggle(t.id)}/></td>
                        <td className="min-w-0 py-2 pr-3">
                          <button type="button" tabIndex={-1} onClick={() => onOpen(t)} className="flex w-full min-w-0 cursor-pointer items-center gap-1.5 text-left">
                            {t.priority === "high" ? <Flag className="size-3.5 shrink-0 fill-stage-late text-stage-late" aria-label="High priority"/> : null}
                            <span className={cn("truncate font-medium group-hover:underline", stage === "done" ? "text-ink-tertiary" : "text-ink")}>{t.title}</span>
                            {fix ? <span title={`Fix: ${fix}`} className="inline-flex shrink-0 items-center gap-1 rounded-full bg-danger-soft px-1.5 py-px text-[10px] font-semibold text-danger"><RotateCcw className="size-2.5" aria-hidden/>Sent back</span> : null}
                          </button>
                          {group !== "milestone" && t.milestone ? <span className="block truncate text-[11px] text-ink-tertiary">{t.milestone.title}</span> : null}
                        </td>
                        <td className="py-2 pr-3 max-sm:hidden">
                          <DropdownMenu>
                            <DropdownMenuTrigger disabled={closed} className={cn("inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-2.5 text-xs font-medium hover:bg-surface-sunken disabled:cursor-default", focusRing)}>
                              <span className={cn("size-2 rounded-full", col.dot)} aria-hidden/>{col.label}
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="start" className="min-w-44">
                              {COLUMNS.map((c) => <DropdownMenuItem key={c.stage} disabled={c.stage === stage} onClick={() => onMove(t, c.stage)}><span className={cn("size-2 rounded-full", c.dot)} aria-hidden/>{c.label}</DropdownMenuItem>)}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </td>
                        <td className="py-2 pr-3 max-md:hidden">
                          <label className="relative flex items-center gap-2">
                            <span className="sr-only">Who does {t.title}</span>
                            {t.assignee ? <Face person={{ id: t.assignee.id, name: t.assignee.full_name, avatarUrl: t.assignee.avatar_url, role: "" }} size={22}/> : <span className="grid size-[22px] shrink-0 place-items-center rounded-full border border-dashed border-line-strong text-ink-tertiary"><UserRound className="size-3" aria-hidden/></span>}
                            <select disabled={locked} value={t.assigned_to ?? ""} onChange={(e) => {
                                const p = crew.find((x) => x.id === e.target.value);
                                void saveOne(t, { assigned_to: p?.id ?? null }, { assigned_to: p?.id ?? null, assignee: p ? { id: p.id, full_name: p.full_name, avatar_url: p.avatar_url } : null });
                            }} className={cn("min-w-0 flex-1 cursor-pointer appearance-none truncate rounded-md bg-transparent py-1 text-[13px] hover:bg-surface-sunken disabled:cursor-default disabled:hover:bg-transparent", t.assignee ? "text-ink" : "text-ink-tertiary", focusRing)}>
                              <option value="">No one</option>
                              {crew.map((p) => <option key={p.id} value={p.id}>{p.full_name}</option>)}
                            </select>
                          </label>
                        </td>
                        <td className="py-2 pr-3">
                          <label className={cn("relative inline-flex items-center gap-1.5 rounded-md text-[13px] tabular", late ? "font-semibold text-danger" : t.due_date ? "text-ink-secondary" : "text-ink-tertiary")}>
                            <CalendarDays className="size-3.5 shrink-0" aria-hidden/>
                            {t.due_date ? (late ? `${daysBetween(t.due_date, today)}d late` : short(t.due_date)) : "Set date"}
                            <input type="date" disabled={locked} value={t.due_date ?? ""} aria-label={`Due date for ${t.title}`} onChange={(e) => void saveOne(t, { due_date: e.target.value || null }, { due_date: e.target.value || null })} className="absolute inset-0 cursor-pointer opacity-0 disabled:cursor-default [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:size-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"/>
                          </label>
                        </td>
                        <td className="py-2 pr-4 max-lg:hidden">
                          <span className="flex items-center justify-end gap-2.5 text-xs text-ink-tertiary tabular">
                            {steps.total > 0 ? <span className={cn(steps.done === steps.total && "text-success")}>{steps.done}/{steps.total}</span> : null}
                            {comments[t.id] ? <span className="inline-flex items-center gap-0.5"><MessageSquare className="size-3" aria-hidden/>{comments[t.id]}</span> : null}
                            {fileCounts.get(t.id) ? <span className="inline-flex items-center gap-0.5"><Paperclip className="size-3" aria-hidden/>{fileCounts.get(t.id)}</span> : null}
                          </span>
                        </td>
                      </motion.tr>);
                }) : null}
              </tbody>);
        })}
        </table>
        {tasks.length === 0 ? <p className="px-6 py-10 text-center text-sm text-ink-tertiary">No tasks match. Add one above, or clear the filters.</p> : null}
      </div>

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
            <button type="button" onClick={() => setSelected(new Set())} aria-label="Clear selection" className="grid size-8 shrink-0 cursor-pointer place-items-center rounded-xl hover:bg-white/10"><X className="size-4" aria-hidden/></button>
          </motion.div>) : null}
      </AnimatePresence>
    </div>);
}

function Th({ label, k, sort, onSort, className }: {
    label: string;
    k: SortKey;
    sort: { key: SortKey; dir: 1 | -1 };
    onSort: (k: SortKey) => void;
    className?: string;
}) {
    const on = sort.key === k;
    const Icon = sort.dir === 1 ? ArrowUp : ArrowDown;
    return (<th className={cn("py-1.5 pr-3 font-medium", className)} aria-sort={on ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button type="button" onClick={() => onSort(k)} className={cn("inline-flex cursor-pointer items-center gap-1 rounded-md py-1 hover:text-ink", on && "text-ink", focusRing)}>
        {label}{on ? <Icon className="size-3" aria-hidden/> : null}
      </button>
    </th>);
}

function Check({ on, label, onClick }: {
    on: boolean;
    label: string;
    onClick: () => void;
}) {
    return (<button type="button" role="checkbox" aria-checked={on} aria-label={label} tabIndex={-1} onClick={onClick} className={cn("grid size-[18px] cursor-pointer place-items-center rounded-[5px] transition-colors duration-200", on ? "bg-brand text-white" : "border-[1.5px] border-line-strong bg-surface hover:border-ink-tertiary", focusRing)}>
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

type Group = { key: string; label: string; dot?: string; tasks: TaskWithRelations[] };

/** Milestones in date order (then "No milestone"); people by name (then "No one"); stages in flow order. */
function groupTasks(tasks: TaskWithRelations[], by: GroupBy, milestones: Milestone[], people: Profile[]): Group[] {
    if (by === "none")
        return [{ key: "all", label: "All tasks", tasks }];
    if (by === "stage")
        return COLUMNS.map((c) => ({ key: c.stage, label: c.label, dot: c.dot, tasks: tasks.filter((t) => normalizeBoardStage(t.stage) === c.stage) }));
    if (by === "person") {
        const list: Group[] = [...people].sort((a, b) => a.full_name.localeCompare(b.full_name))
            .map((p) => ({ key: p.id, label: p.full_name, tasks: tasks.filter((t) => t.assigned_to === p.id) }))
            .filter((g) => g.tasks.length > 0);
        const none = tasks.filter((t) => !t.assigned_to || !people.some((p) => p.id === t.assigned_to));
        return none.length ? [...list, { key: "none", label: "No one", tasks: none }] : list;
    }
    const list: Group[] = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date))
        .map((m) => ({ key: m.id, label: `${m.title} · due ${short(m.due_date)}`, dot: m.completed ? "bg-stage-done" : "bg-copper", tasks: tasks.filter((t) => t.milestone_id === m.id) }));
    const none = tasks.filter((t) => !t.milestone_id);
    return none.length ? [...list, { key: "none", label: "No milestone", tasks: none }] : list;
}
