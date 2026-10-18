"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { CheckCircle2, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { projectBoardPath } from "@/lib/constants";
import { plural } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { parseQuickAdd } from "@/lib/quick-add";
import { milestoneTaskDates } from "@/lib/schedule";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import { logActivity } from "@/services/activity-service";
import { deleteMilestone, updateMilestone } from "@/services/project-service";
import { createTask, type TaskWithRelations } from "@/services/task-service";
import type { Milestone, Profile } from "@/types/database";

const DOT: Record<string, string> = { backlog: "bg-stage-todo", to_do: "bg-stage-todo", in_progress: "bg-stage-progress", review: "bg-stage-review", done: "bg-stage-done" };

type Props = {
    milestone: Milestone | null;
    projectId: string;
    tasks: TaskWithRelations[];
    people: Profile[];
    milestones: Milestone[];
    projectStart: string;
    today: string;
    closed: boolean;
    count: { total: number; accepted: number };
    onClose: () => void;
    onPatch: (id: string, patch: Partial<Milestone>) => void;
    onReschedule: (m: Milestone, to: string) => void;
    onDeleted: (id: string) => void;
};

/** One milestone: its name and date, how close it is to delivered, its tasks, and adding several at once. */
export function MilestonePanel(props: Props) {
    const [last, setLast] = React.useState(props.milestone);
    if (props.milestone && props.milestone !== last)
        setLast(props.milestone);
    return (<Sheet open={!!props.milestone} onOpenChange={(o) => !o && props.onClose()}>
      <SheetContent side="right" className="w-full gap-0 border-line bg-canvas p-0 sm:max-w-md">
        {last ? <Body key={last.id} {...props} milestone={last}/> : null}
      </SheetContent>
    </Sheet>);
}

function Body({ milestone: m, projectId, tasks, people, milestones, projectStart, today, closed, count, onPatch, onReschedule, onDeleted }: Props & {
    milestone: Milestone;
}) {
    const router = useRouter();
    const reduce = useReducedMotion();
    const mine = tasks.filter((t) => t.milestone_id === m.id).sort((a, b) => (a.stage === "done" ? 1 : 0) - (b.stage === "done" ? 1 : 0) || a.position - b.position);
    const [title, setTitle] = React.useState(m.title);
    const [bulk, setBulk] = React.useState("");
    const [adding, setAdding] = React.useState(false);
    const [confirmDelete, setConfirmDelete] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const lines = bulk.split("\n").map((l) => l.trim()).filter(Boolean);
    const share = m.completed ? 1 : count.total ? count.accepted / count.total : 0;

    React.useEffect(() => {
        if (!confirmDelete)
            return;
        const t = window.setTimeout(() => setConfirmDelete(false), 3500);
        return () => window.clearTimeout(t);
    }, [confirmDelete]);

    async function rename() {
        const next = title.trim();
        if (!next || next === m.title) {
            setTitle(m.title);
            return;
        }
        onPatch(m.id, { title: next });
        try {
            await updateMilestone({ id: m.id, title: next });
            router.refresh();
        }
        catch (e) {
            onPatch(m.id, { title: m.title });
            setTitle(m.title);
            toast.error(e instanceof Error ? e.message : "That name didn't save.");
        }
    }

    /** Only a milestone without tasks is delivered by hand; with tasks it delivers itself. */
    async function setDelivered(completed: boolean) {
        onPatch(m.id, { completed });
        try {
            await updateMilestone({ id: m.id, completed, deliverySource: "manual" });
            if (completed)
                void logActivity({ project_id: projectId, action_type: "milestone_completed", details: { milestone_id: m.id, title: m.title } });
            router.refresh();
        }
        catch (e) {
            onPatch(m.id, { completed: !completed });
            toast.error(e instanceof Error ? e.message : "That didn't save.");
        }
    }

    async function addAll() {
        if (!lines.length || adding)
            return;
        setAdding(true);
        const lookup = { people: people.map((p) => ({ id: p.id, name: p.full_name })), milestones: [], today };
        let made = 0;
        try {
            for (const line of lines) {
                const p = parseQuickAdd(line, lookup);
                if (!p.title)
                    continue;
                const created = await createTask({ project_id: projectId, title: p.title, milestone_id: m.id, assigned_to: p.assigneeId, ...milestoneTaskDates(m.id, milestones, projectStart, today, p.dueDate), stage: "to_do" });
                void logActivity({ project_id: projectId, action_type: "task_created", details: { task_id: created.id, title: created.title } });
                made += 1;
            }
            setBulk("");
            toast.success(`Added ${plural(made, "task")} to ${m.title}`);
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : `Stopped after ${plural(made, "task")}.`);
        }
        finally {
            setAdding(false);
            router.refresh();
        }
    }

    async function remove() {
        if (!confirmDelete) {
            setConfirmDelete(true);
            return;
        }
        setBusy(true);
        try {
            await deleteMilestone(m.id);
            toast.success(`Deleted ${m.title}`, { description: mine.length ? `Its ${plural(mine.length, "task")} stay on the board.` : undefined });
            onDeleted(m.id);
        }
        catch (e) {
            setBusy(false);
            toast.error(e instanceof Error ? e.message : "That milestone couldn't be deleted.");
        }
    }

    const position = [...milestones].sort((a, b) => a.due_date.localeCompare(b.due_date)).findIndex((x) => x.id === m.id) + 1;
    return (<>
      <SheetHeader className="gap-3 border-b border-line px-6 pt-6 pb-5">
        <SheetDescription className="text-xs text-ink-tertiary tabular">Milestone {position} of {milestones.length}</SheetDescription>
        <SheetTitle className="sr-only">{m.title}</SheetTitle>
        <input value={title} disabled={closed} onChange={(e) => setTitle(e.target.value)} onBlur={() => void rename()} onKeyDown={(e) => e.key === "Enter" && e.currentTarget.blur()} aria-label="Milestone name" className="-mx-2 rounded-xl bg-transparent px-2 py-1 text-[1.35rem] font-semibold tracking-[-0.025em] text-ink hover:bg-surface-sunken focus:bg-surface focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none disabled:hover:bg-transparent"/>
        <label className="flex items-center gap-3 text-sm text-ink-secondary">Due
          <input type="date" value={m.due_date} disabled={closed || m.completed} onChange={(e) => e.target.value && onReschedule(m, e.target.value)} className={cn("h-9 rounded-xl border border-line bg-surface px-3 text-sm tabular focus:border-brand focus:outline-none disabled:opacity-60", !m.completed && m.due_date < today ? "border-danger/40 text-danger" : "text-ink")}/>
          {!m.completed && m.due_date < today ? <span className="text-xs font-semibold text-danger">Late</span> : null}
        </label>
      </SheetHeader>

      <div className="grid flex-1 content-start gap-6 overflow-y-auto px-6 py-5">
        <section aria-label="Delivery" className="grid gap-2.5 rounded-2xl bg-surface-subtle p-4 ring-1 ring-line">
          <div className="flex items-baseline justify-between gap-3">
            <p className="text-sm font-semibold">{m.completed ? "Delivered" : count.total ? `${count.accepted} of ${plural(count.total, "task")} accepted` : "No tasks yet"}</p>
            {m.completed ? <CheckCircle2 className="size-4 text-success" aria-hidden/> : null}
          </div>
          <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken">
            <motion.span className={cn("block h-full rounded-full", m.completed ? "bg-stage-done" : "bg-brand")} initial={reduce ? false : { width: 0 }} animate={{ width: `${share * 100}%` }} transition={SPRING}/>
          </span>
          <p className="text-xs text-ink-tertiary">{count.total > 0 ? "It delivers itself, and tells the client, once every task in it is accepted." : "With no tasks, you mark it delivered yourself."}</p>
          {count.total === 0 && !closed ? (<button type="button" onClick={() => void setDelivered(!m.completed)} className={cn(m.completed ? softAction : primaryAction, "h-9 w-fit")}>
              {m.completed ? "Not delivered yet" : "Mark delivered"}
            </button>) : null}
        </section>

        <section aria-label="Tasks" className="grid gap-2">
          <h3 className="flex items-center justify-between text-xs font-medium text-ink-secondary">Tasks
            {mine.length > 0 ? <Link href={projectBoardPath(projectId, { milestone: m.id })} className={cn("rounded-sm text-ink-tertiary hover:text-ink", focusRing)}>On the board</Link> : null}
          </h3>
          {mine.length > 0 ? (<ul className="grid">
              {mine.map((t, i) => (<motion.li key={t.id} initial={reduce ? false : { opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ ...SPRING, delay: i * 0.03 }}>
                  <Link href={`${projectBoardPath(projectId)}?task=${t.id}`} className={cn("flex items-center gap-2.5 rounded-xl px-2 py-2 hover:bg-surface-sunken", focusRing)}>
                    <span className={cn("size-2 shrink-0 rounded-full", DOT[t.stage] ?? "bg-stage-todo")} aria-hidden/>
                    <span className={cn("min-w-0 flex-1 truncate text-sm", t.stage === "done" ? "text-ink-tertiary" : "text-ink")}>{t.title}</span>
                    <span className="sr-only">, {TASK_STAGE_TERMS[t.stage].label}</span>
                    <span className="shrink-0 text-xs text-ink-tertiary">{t.assignee?.full_name.split(" ")[0] ?? "No one"}</span>
                  </Link>
                </motion.li>))}
            </ul>) : null}
          {!closed ? (<div className="grid gap-2">
              <label>
                <span className="sr-only">Add tasks, one per line</span>
                <textarea value={bulk} onChange={(e) => setBulk(e.target.value)} onKeyDown={(e) => {
                    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
                        e.preventDefault();
                        void addAll();
                    }
                }} rows={3} placeholder={"One task per line\nSet the forms @ana\nPour the slab fri"} className="field-sizing-content min-h-20 w-full resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
              </label>
              {lines.length > 0 ? (<button type="button" disabled={adding} onClick={() => void addAll()} className={cn(primaryAction, "h-9 w-fit")}>
                  {adding ? <Loader2 className="animate-spin" aria-hidden/> : null}Add {plural(lines.length, "task")}
                </button>) : <p className="text-xs text-ink-tertiary">@name assigns it; a day sets its date, otherwise it&apos;s due with the milestone.</p>}
            </div>) : null}
        </section>
      </div>

      {!closed ? (<footer className="border-t border-line px-6 py-3">
          <button type="button" disabled={busy} onClick={() => void remove()} className={cn("press inline-flex h-9 cursor-pointer items-center gap-1.5 rounded-full px-3.5 text-sm font-medium transition-colors duration-300", confirmDelete ? "bg-danger text-white" : "text-ink-tertiary hover:bg-danger-soft hover:text-danger", focusRing)}>
            {busy ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Trash2 className="size-4" aria-hidden/>}{confirmDelete ? (mine.length ? "Delete? Its tasks stay" : "Click again to delete") : "Delete milestone"}
          </button>
        </footer>) : null}
    </>);
}
