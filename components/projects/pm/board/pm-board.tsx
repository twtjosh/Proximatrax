"use client";
import * as React from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { DragDropContext, Draggable, Droppable, type DraggableProvidedDragHandleProps, type DropResult } from "@hello-pangea/dnd";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { CalendarDays, Columns3, CornerDownLeft, Flag, List, Lock, MessageSquare, Paperclip, Plus, RotateCcw, Search, SquareCheck, X } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { QUICK_ADD_EVENT } from "@/components/projects/pm/project-shortcuts";
import { checklistProgress, normalizeBoardStage, taskBlockedReason, type BoardColumnStage } from "@/lib/board-workflow";
import { daysBetween, duePhrase } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { parseQuickAdd } from "@/lib/quick-add";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";
import { publicTaskAttachmentUrl } from "@/services/task-attachment-service";
import { createTask, type TaskWithRelations } from "@/services/task-service";
import { notifyWorkReadyAfterProjectTaskChange, snapshotProjectTasksForNotify } from "@/services/work-notification-service";
import type { Milestone, Profile, TaskAttachment } from "@/types/database";
import { COLUMNS, fixReason, isLate } from "./board-meta";
import { TaskList } from "./task-list";
import { TaskSheet } from "./task-sheet";
import { setQuery as setParams, useTaskActions } from "./use-task-actions";

/** Accepted work piles up; the newest few are enough on the board. */
const ACCEPTED_SHOWN = 3;
const errorText = (e: unknown, fallback: string) => (e instanceof Error && e.message ? e.message : fallback);

/** High first, then what is late, then by due date. Accepted: newest first. */
function order(stage: BoardColumnStage, tasks: TaskWithRelations[], today: string) {
    if (stage === "done")
        return [...tasks].sort((a, b) => b.updated_at.localeCompare(a.updated_at));
    return [...tasks].sort((a, b) => Number(b.priority === "high") - Number(a.priority === "high")
        || Number(isLate(b, today)) - Number(isLate(a, today))
        || (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999")
        || a.position - b.position);
}

/**
 * The PM's board: one line adds a task, filters live in the URL, cards drag
 * one stage at a time. In review is decided in Review mode, so a card dragged
 * out of it opens there; Accepted is the client's record and stays put.
 */
export function PmBoard({ projectId, tasks, attachments, comments, milestones, people, today, viewerId, closed }: {
    projectId: string;
    tasks: TaskWithRelations[];
    attachments: TaskAttachment[];
    /** Discussion length per task. */
    comments: Record<string, number>;
    milestones: Milestone[];
    /** Who can be given work: the PM and the project's crew. */
    people: Profile[];
    today: string;
    viewerId: string;
    closed: boolean;
}) {
    const router = useRouter();
    const params = useSearchParams();
    const reduce = useReducedMotion();
    const { items, setItems, byTask, counts, gate, show, patchTask, requestMove, sheet } = useTaskActions({ projectId, viewerId, closed, milestones, tasks, attachments, comments });
    const [query, setQuery] = React.useState(params.get("q") ?? "");
    const [allAccepted, setAllAccepted] = React.useState(false);
    const assignee = params.get("mine") === "1" ? viewerId : params.get("assignee");
    const milestone = params.get("milestone");
    const lateOnly = params.get("late") === "1";
    const focusStage = params.get("stage");
    const view = params.get("view") === "list" ? "list" : "board";

    const needle = query.trim().toLowerCase();
    const visible = items.filter((t) => (!assignee || (assignee === "none" ? !t.assigned_to : t.assigned_to === assignee))
        && (!milestone || t.milestone_id === milestone)
        && (!lateOnly || isLate(t, today))
        && (!needle || t.title.toLowerCase().includes(needle)));
    const filtered = visible.length !== items.length;
    const lateCount = items.filter((t) => isLate(t, today)).length;
    const crew = people.filter((p) => p.role === "middleman");

    function onDragEnd({ source, destination, draggableId }: DropResult) {
        const task = items.find((t) => t.id === draggableId);
        if (task && destination && destination.droppableId !== source.droppableId)
            requestMove(task, destination.droppableId as BoardColumnStage);
    }

    // ?stage= from the Overview's counts brings that column into view on a phone.
    React.useEffect(() => {
        if (focusStage)
            document.getElementById(`column-${focusStage}`)?.scrollIntoView({ inline: "start", block: "nearest" });
    }, [focusStage]);

    const fileCounts = new Map([...byTask].map(([id, list]) => [id, list.length]));

    return (<div className="grid gap-4 pt-2">
      <QuickAdd projectId={projectId} people={people} milestones={milestones} today={today} closed={closed} onAdded={(task) => {
            setItems((list) => [...list, task]);
            router.refresh();
        }}/>

      <div className="flex flex-wrap items-center gap-2">
        <label className="relative flex h-9 min-w-0 basis-full items-center sm:max-w-60 sm:basis-60">
          <Search className="pointer-events-none absolute left-3 size-4 text-ink-tertiary" aria-hidden/>
          <span className="sr-only">Search tasks</span>
          <input value={query} onChange={(e) => setQuery(e.target.value)} onBlur={() => setParams({ q: query.trim() || null })} placeholder="Search" className="h-9 w-full rounded-full border border-line bg-surface pr-3 pl-9 text-sm placeholder:text-ink-tertiary focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
        </label>
        {crew.length > 0 ? (<div className="flex items-center gap-1 rounded-full bg-surface-sunken p-1" role="group" aria-label="Show one person's work">
            {crew.map((p) => {
                const on = assignee === p.id;
                return (<button key={p.id} type="button" aria-pressed={on} title={p.full_name} onClick={() => setParams({ assignee: on ? null : p.id, mine: null })} className={cn("press grid cursor-pointer place-items-center rounded-full ring-2 transition-[box-shadow,opacity] duration-300", on ? "ring-brand" : "ring-transparent", assignee && !on && "opacity-45 hover:opacity-100", focusRing)}>
                  <Face person={{ id: p.id, name: p.full_name, avatarUrl: p.avatar_url, role: "" }} size={26}/>
                  <span className="sr-only">{p.full_name}</span>
                </button>);
            })}
            <button type="button" aria-pressed={assignee === "none"} onClick={() => setParams({ assignee: assignee === "none" ? null : "none", mine: null })} className={cn("press h-[26px] cursor-pointer rounded-full px-2.5 text-xs font-medium transition-colors duration-300", assignee === "none" ? "bg-ink text-white" : "text-ink-secondary hover:text-ink", focusRing)}>No one</button>
          </div>) : null}
        {milestones.length > 0 ? (<label className="relative">
            <span className="sr-only">Milestone</span>
            <select value={milestone ?? ""} onChange={(e) => setParams({ milestone: e.target.value || null })} className={cn("h-9 max-w-48 cursor-pointer appearance-none truncate rounded-full border border-line bg-surface pr-8 pl-3.5 text-sm", milestone ? "border-ink font-medium text-ink" : "text-ink-secondary", focusRing)}>
              <option value="">All milestones</option>
              {milestones.map((m) => <option key={m.id} value={m.id}>{m.title}</option>)}
            </select>
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-3 -translate-y-1/2 text-[10px] text-ink-tertiary">▼</span>
          </label>) : null}
        {lateCount > 0 || lateOnly ? (<button type="button" aria-pressed={lateOnly} onClick={() => setParams({ late: lateOnly ? null : "1" })} className={cn("press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-300", lateOnly ? "bg-danger text-white" : "bg-danger-soft text-danger hover:bg-danger/15", focusRing)}>
            <span className={cn("size-1.5 rounded-full", lateOnly ? "bg-white" : "bg-stage-late")} aria-hidden/>{lateCount} late
          </button>) : null}
        <AnimatePresence>
          {filtered ? (<motion.p initial={{ opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0 }} transition={SPRING} className="flex items-center gap-2 text-xs text-ink-tertiary">
              <span className="tabular">{visible.length} of {items.length}</span>
              <button type="button" onClick={() => {
                    setQuery("");
                    setParams({ q: null, assignee: null, mine: null, milestone: null, late: null });
                }} className={cn("press inline-flex h-7 cursor-pointer items-center gap-1 rounded-full bg-surface-sunken px-2.5 font-medium text-ink-secondary hover:text-ink", focusRing)}><X className="size-3" aria-hidden/>Clear</button>
            </motion.p>) : null}
        </AnimatePresence>
        <div role="radiogroup" aria-label="View" className="ml-auto flex rounded-full bg-surface-sunken p-1">
          {([["board", "Board", Columns3], ["list", "List", List]] as const).map(([key, label, Icon]) => (<button key={key} type="button" role="radio" aria-checked={view === key} onClick={() => setParams({ view: key === "list" ? "list" : null })} className={cn("relative isolate inline-flex h-7 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-300", view === key ? "text-ink" : "text-ink-secondary hover:text-ink", focusRing)}>
              {view === key ? <motion.span layoutId="tasks-view" transition={SPRING} className="absolute inset-0 -z-10 rounded-full bg-surface shadow-card"/> : null}
              <Icon className="size-3.5" aria-hidden/>{label}
            </button>))}
        </div>
      </div>

      {view === "list" ? <TaskList tasks={visible} people={people} milestones={milestones} today={today} closed={closed} fileCounts={fileCounts} comments={counts} onOpen={show} onMove={requestMove} onPatch={patchTask} onRemoved={(ids) => setItems((list) => list.filter((t) => !ids.includes(t.id)))}/> : null}

      {view === "board" ? (<DragDropContext onDragEnd={onDragEnd}>
        <div className="-mx-4 flex snap-x snap-mandatory gap-3 overflow-x-auto px-4 pb-4 [scrollbar-width:none] lg:mx-0 lg:grid lg:grid-cols-4 lg:overflow-visible lg:px-0">
          {COLUMNS.map((col, ci) => {
                const all = order(col.stage, visible.filter((t) => normalizeBoardStage(t.stage) === col.stage), today);
                const shown = col.stage === "done" && !allAccepted ? all.slice(0, ACCEPTED_SHOWN) : all;
                return (<section key={col.stage} id={`column-${col.stage}`} aria-label={col.label} style={{ "--i": ci } as React.CSSProperties} className="materialize flex w-[min(20rem,82vw)] shrink-0 snap-start flex-col rounded-[22px] bg-surface-subtle p-2 ring-1 ring-line lg:w-auto">
                <header className="flex items-center gap-2 px-2.5 pt-1.5 pb-2.5">
                  <span className={cn("size-2 rounded-full", col.dot)} aria-hidden/>
                  <h2 className="text-sm font-semibold tracking-[-0.01em]">{col.label}</h2>
                  <span className="text-xs text-ink-tertiary tabular">{all.length}</span>
                  <span className="ml-auto truncate text-[11px] text-ink-tertiary">{col.hint}</span>
                </header>
                <Droppable droppableId={col.stage} isDropDisabled={closed}>
                  {(drop, dropState) => (<ul ref={drop.innerRef} {...drop.droppableProps} className={cn("grid min-h-24 flex-1 content-start gap-2 rounded-2xl p-0.5 transition-colors duration-300", dropState.isDraggingOver && "bg-brand-soft/60")}>
                      {shown.map((t, i) => (<Draggable key={t.id} draggableId={t.id} index={i} isDragDisabled={closed || col.stage === "done"} disableInteractiveElementBlocking>
                          {(drag, dragState) => (<li ref={drag.innerRef} {...drag.draggableProps} style={drag.draggableProps.style}>
                              <Card handle={drag.dragHandleProps} task={t} comments={counts[t.id] ?? 0} today={today} files={byTask.get(t.id) ?? []} blocked={col.stage === "to_do" ? taskBlockedReason(t, "project_manager", gate) : null} dragging={dragState.isDragging} onOpen={() => show(t)}/>
                            </li>)}
                        </Draggable>))}
                      {drop.placeholder}
                      {all.length === 0 && !dropState.isDraggingOver ? <EmptyColumn stage={col.stage} filtered={filtered}/> : null}
                      {col.stage === "done" && all.length > ACCEPTED_SHOWN ? (<li>
                          <button type="button" onClick={() => setAllAccepted((v) => !v)} className={cn("press h-9 w-full cursor-pointer rounded-xl text-xs font-medium text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
                            {allAccepted ? "Show the newest" : `+${all.length - ACCEPTED_SHOWN} more accepted`}
                          </button>
                        </li>) : null}
                    </ul>)}
                </Droppable>
              </section>);
            })}
        </div>
      </DragDropContext>) : null}

      <TaskSheet {...sheet} people={people} today={today} reduce={!!reduce}/>
    </div>);
}

function EmptyColumn({ stage, filtered }: {
    stage: BoardColumnStage;
    filtered: boolean;
}) {
    const text = filtered ? "Nothing matches" : stage === "to_do" ? "Add work above, or press N" : stage === "in_progress" ? "No one is working on anything" : stage === "review" ? "Nothing waiting on you" : "Nothing accepted yet";
    return <li className="grid min-h-20 place-items-center rounded-2xl border border-dashed border-line px-3 text-center text-xs text-ink-tertiary">{text}</li>;
}

/** A card says what matters at a glance: who, when, why it is stuck, and if it came back. */
function Card({ handle, task, comments, today, files, blocked, dragging, onOpen }: {
    /** The drag handle is the card itself, so it is one tab stop: Enter opens, Space lifts. */
    handle: DraggableProvidedDragHandleProps | null;
    task: TaskWithRelations;
    comments: number;
    today: string;
    files: TaskAttachment[];
    blocked: string | null;
    dragging: boolean;
    onOpen: () => void;
}) {
    const stage = normalizeBoardStage(task.stage);
    const late = isLate(task, today);
    const steps = checklistProgress(task.checklist);
    const fix = stage === "in_progress" ? fixReason(task) : null;
    const photo = stage === "review" ? files.find((a) => a.media_kind === "photo") : undefined;
    return (<button type="button" {...handle} onClick={onOpen} className={cn("group grid w-full cursor-pointer gap-2 rounded-2xl bg-surface p-3.5 text-left shadow-card ring-1 ring-line transition-[box-shadow,transform,rotate] duration-300 ease-spring hover:ring-line-strong", dragging && "rotate-[1.5deg] shadow-[0_18px_40px_-12px_rgb(14_18_34/0.35)] ring-brand/40", focusRing)}>
      {photo ? (<span className="-mx-1.5 -mt-1.5 block overflow-hidden rounded-xl">
          {/* eslint-disable-next-line @next/next/no-img-element -- submitted site photo */}
          <img src={publicTaskAttachmentUrl(photo.storage_path)} alt="" draggable={false} className="h-24 w-full object-cover transition-transform duration-500 ease-spring group-hover:scale-[1.03]"/>
        </span>) : null}
      {task.milestone ? <span className="truncate text-[11px] text-ink-tertiary">{task.milestone.title}</span> : null}
      <span className="flex items-start gap-1.5 text-[14px] leading-snug font-medium text-pretty text-ink">
        {task.priority === "high" ? <Flag className="mt-0.5 size-3.5 shrink-0 fill-stage-late text-stage-late" aria-label="High priority"/> : null}
        {task.title}
      </span>
      {fix ? (<span className="flex items-start gap-1.5 rounded-lg bg-danger-soft px-2 py-1.5 text-xs text-danger"><RotateCcw className="mt-px size-3 shrink-0" aria-hidden/><span className="line-clamp-2">Fix: {fix}</span></span>) : null}
      {blocked && blocked !== "Needs owner" ? (<span className="flex items-center gap-1.5 text-xs text-ink-tertiary"><Lock className="size-3" aria-hidden/>{blocked}</span>) : null}
      <span className="flex items-center gap-2.5 text-xs text-ink-tertiary">
        {task.assignee ? <Face person={{ id: task.assignee.id, name: task.assignee.full_name, avatarUrl: task.assignee.avatar_url, role: "" }} size={22}/> : <span className="grid size-[22px] place-items-center rounded-full border border-dashed border-line-strong" title="No one yet" aria-label="No one yet"/>}
        {task.due_date && stage !== "done" ? (<span className={cn("inline-flex items-center gap-1 tabular", late && "font-medium text-danger")}><CalendarDays className="size-3" aria-hidden/>{late ? `${daysBetween(task.due_date, today)}d late` : duePhrase(task.due_date, today)}</span>) : null}
        <span className="ml-auto flex items-center gap-2.5">
          {steps.total > 0 ? <span className={cn("inline-flex items-center gap-1 tabular", steps.done === steps.total && "text-success")}><SquareCheck className="size-3" aria-hidden/>{steps.done}/{steps.total}</span> : null}
          {comments > 0 ? <span className="inline-flex items-center gap-1 tabular"><MessageSquare className="size-3" aria-hidden/>{comments}</span> : null}
          {files.length > 0 ? <span className="inline-flex items-center gap-1 tabular"><Paperclip className="size-3" aria-hidden/>{files.length}</span> : null}
        </span>
      </span>
    </button>);
}

/**
 * One line becomes a task: "Tile the kitchen @ana #finishing fri". Typing @
 * or # offers matches; Tab takes the first. Pressing N anywhere focuses it.
 */
function QuickAdd({ projectId, people, milestones, today, closed, onAdded }: {
    projectId: string;
    people: Profile[];
    milestones: Milestone[];
    today: string;
    closed: boolean;
    onAdded: (task: TaskWithRelations) => void;
}) {
    const params = useSearchParams();
    const reduce = useReducedMotion();
    const ref = React.useRef<HTMLInputElement>(null);
    const [text, setText] = React.useState("");
    const [busy, setBusy] = React.useState(false);
    const lookup = { people: people.map((p) => ({ id: p.id, name: p.full_name })), milestones: milestones.map((m) => ({ id: m.id, title: m.title })), today };
    const parsed = parseQuickAdd(text, lookup);
    const word = /(?:^|\s)([@#])(\S*)$/.exec(text);
    const squash = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
    const suggestions = !word ? [] : word[1] === "@"
        ? people.filter((p) => p.full_name.toLowerCase().split(/\s+/).some((n) => n.startsWith(word[2].toLowerCase()))).slice(0, 5).map((p) => ({ id: p.id, label: p.full_name, insert: `@${p.full_name.split(/\s+/)[0]}` }))
        : milestones.filter((m) => squash(m.title).startsWith(squash(word[2]))).slice(0, 5).map((m) => ({ id: m.id, label: m.title, insert: `#${squash(m.title)}` }));

    React.useEffect(() => {
        const focus = () => ref.current?.focus();
        window.addEventListener(QUICK_ADD_EVENT, focus);
        return () => window.removeEventListener(QUICK_ADD_EVENT, focus);
    }, []);
    // Arriving from "N" on another tab: ?add=1 focuses, then goes.
    React.useEffect(() => {
        if (params.get("add") !== "1")
            return;
        ref.current?.focus();
        const next = new URLSearchParams(window.location.search);
        next.delete("add");
        const qs = next.toString();
        window.history.replaceState(null, "", qs ? `?${qs}` : window.location.pathname);
    }, [params]);

    function complete(insert: string) {
        setText((t) => `${t.replace(/[@#]\S*$/, "")}${insert} `);
        ref.current?.focus();
    }

    async function add() {
        if (!parsed.title || busy || closed)
            return;
        setBusy(true);
        try {
            const before = parsed.assigneeId ? await snapshotProjectTasksForNotify(projectId) : null;
            const created = await createTask({ project_id: projectId, title: parsed.title, assigned_to: parsed.assigneeId, milestone_id: parsed.milestoneId, due_date: parsed.dueDate, stage: "to_do" });
            void logActivity({ project_id: projectId, action_type: "task_created", details: { task_id: created.id, title: created.title } });
            if (before)
                void notifyWorkReadyAfterProjectTaskChange(projectId, before);
            const person = people.find((p) => p.id === created.assigned_to);
            const ms = milestones.find((m) => m.id === created.milestone_id);
            onAdded({ ...created, assignee: person ? { id: person.id, full_name: person.full_name, avatar_url: person.avatar_url } : null, milestone: ms ? { id: ms.id, title: ms.title } : null });
            setText("");
        }
        catch (e) {
            toast.error(errorText(e, "That task couldn't be added."));
        }
        finally {
            setBusy(false);
            ref.current?.focus();
        }
    }

    if (closed)
        return null;
    return (<div className="relative">
      <form onSubmit={(e) => {
            e.preventDefault();
            void add();
        }} className="flex items-center gap-2 rounded-[20px] material p-1.5 pl-4 transition-shadow duration-300 focus-within:shadow-[0_0_0_4px_rgb(217_119_6/0.14)]">
        <Plus className="size-4 shrink-0 text-ink-tertiary" aria-hidden/>
        <label className="min-w-0 flex-1">
          <span className="sr-only">Add a task</span>
          <input ref={ref} value={text} onChange={(e) => setText(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Tab" && suggestions[0] && !e.shiftKey) {
                    e.preventDefault();
                    complete(suggestions[0].insert);
                }
                else if (e.key === "Escape") {
                    setText("");
                    ref.current?.blur();
                }
            }} placeholder="Add a task… try “Tile the kitchen @name #milestone fri”" autoComplete="off" className="h-10 w-full bg-transparent text-[15px] placeholder:text-ink-tertiary focus:outline-none"/>
        </label>
        <button type="submit" disabled={!parsed.title || busy} className={cn("press inline-flex h-10 shrink-0 cursor-pointer items-center gap-1.5 rounded-2xl bg-ink px-4 text-sm font-medium text-white transition-opacity duration-300 disabled:cursor-default disabled:opacity-35", focusRing)}>
          Add<CornerDownLeft className="size-3.5 opacity-70" aria-hidden/>
        </button>
      </form>
      <AnimatePresence initial={false}>
        {suggestions.length > 0 || parsed.tokens.length > 0 ? (<motion.div initial={reduce ? false : { opacity: 0, y: -4, height: 0 }} animate={{ opacity: 1, y: 0, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} className="overflow-hidden">
            <div className="flex flex-wrap items-center gap-1.5 px-2 pt-2">
              {suggestions.length > 0 ? suggestions.map((s, i) => (<button key={s.id} type="button" onClick={() => complete(s.insert)} className={cn("press inline-flex h-7 cursor-pointer items-center gap-1 rounded-full px-3 text-xs font-medium", i === 0 ? "bg-ink text-white" : "bg-surface-sunken text-ink-secondary hover:text-ink", focusRing)}>
                    {s.label}{i === 0 ? <kbd className="ml-1 rounded bg-white/20 px-1 font-sans text-[10px]">Tab</kbd> : null}
                  </button>)) : parsed.tokens.map((t) => (<motion.span key={t.kind} layout initial={reduce ? false : { opacity: 0, scale: 0.9 }} animate={{ opacity: 1, scale: 1 }} transition={SPRING} className={cn("inline-flex h-7 items-center gap-1 rounded-full px-3 text-xs font-medium", t.kind === "person" ? "bg-brand-soft text-brand-hover" : t.kind === "milestone" ? "bg-surface-sunken text-ink" : "bg-info-soft text-info")}>
                    {t.kind === "person" ? "For" : t.kind === "milestone" ? "In" : "Due"} {t.label}
                  </motion.span>))}
            </div>
          </motion.div>) : null}
      </AnimatePresence>
    </div>);
}
