"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Lock, Trash2, X } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ROUTES } from "@/lib/constants";
import type { DashboardMilestone } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { assessProjectClosureReadiness, DEFAULT_COMPLETION_STATEMENT } from "@/lib/project-lifecycle";
import { cn } from "@/lib/utils";
import { completeProject, deleteProjectPermanently, reopenProject, updateProject, type ProjectWithRelations } from "@/services/project-service";

const field = "w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-300 ease-spring placeholder:text-ink-tertiary hover:border-line-strong focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none";

type Field = "title" | "description" | "start_date" | "end_date";

/**
 * The project's settings in one panel: its details, each saved on its own the
 * moment you leave the field, and closing (or reopening) the project, with
 * the checks that decide whether it can close, and deleting it for good.
 */
export function SettingsPanel({ open, onOpenChange, section, project, milestones, tasks, viewerId }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** "close" or "delete" scrolls straight to that section. */
    section: string | null;
    project: ProjectWithRelations;
    milestones: DashboardMilestone[];
    tasks: { stage: string }[];
    viewerId: string;
}) {
    const router = useRouter();
    const reduce = useReducedMotion();
    const [saved, setSaved] = React.useState<Field | null>(null);
    const [saving, setSaving] = React.useState<Field | null>(null);
    const [statement, setStatement] = React.useState(project.completion_statement ?? DEFAULT_COMPLETION_STATEMENT);
    const [busy, setBusy] = React.useState(false);
    const [confirmReopen, setConfirmReopen] = React.useState(false);
    const closeRef = React.useRef<HTMLElement>(null);
    const deleteRef = React.useRef<HTMLElement>(null);
    const [confirmName, setConfirmName] = React.useState("");
    const [deleting, setDeleting] = React.useState(false);
    const readiness = assessProjectClosureReadiness(project, milestones, tasks as never);
    const closed = project.status === "completed";

    React.useEffect(() => {
        const target = section === "close" ? closeRef : section === "delete" ? deleteRef : null;
        if (!open || !target)
            return;
        // After the sheet has slid in; before that the section isn't laid out.
        const t = window.setTimeout(() => target.current?.scrollIntoView({ block: "start", behavior: "smooth" }), 320);
        return () => window.clearTimeout(t);
    }, [open, section]);

    async function save(name: Field, value: string) {
        const current = (project[name] ?? "") as string;
        if (value.trim() === current.trim())
            return;
        if (name === "title" && !value.trim()) {
            toast.error("A project needs a title.");
            return;
        }
        const start = name === "start_date" ? value : project.start_date;
        const end = name === "end_date" ? value : project.end_date;
        if (end < start) {
            toast.error("The end date can't be before the start date.");
            return;
        }
        setSaving(name);
        try {
            await updateProject({ id: project.id, [name]: name === "description" ? value.trim() || null : value.trim() });
            setSaved(name);
            window.setTimeout(() => setSaved((s) => (s === name ? null : s)), 1800);
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "That didn't save. Try again.");
        }
        finally {
            setSaving(null);
        }
    }

    async function remove() {
        if (confirmName.trim() !== project.title.trim() || deleting)
            return;
        setDeleting(true);
        try {
            await deleteProjectPermanently(project.id);
            toast.success(`Deleted ${project.title}`, { description: "The project and everything in it are gone." });
            router.replace(ROUTES.PROJECTS);
            router.refresh();
        }
        catch (e) {
            setDeleting(false);
            toast.error(e instanceof Error ? e.message : "The project couldn't be deleted. Try again.");
        }
    }

    async function close() {
        setBusy(true);
        try {
            await completeProject(project.id, viewerId, statement.trim() || DEFAULT_COMPLETION_STATEMENT);
            toast.success("Project closed. The client now sees the handover record.");
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "The project couldn't be closed.");
        }
        finally {
            setBusy(false);
        }
    }

    async function reopen() {
        setBusy(true);
        try {
            await reopenProject(project.id);
            toast.success("Project reopened.");
            setConfirmReopen(false);
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "The project couldn't be reopened.");
        }
        finally {
            setBusy(false);
        }
    }

    const mark = (name: Field) => (<span className="ml-auto inline-flex h-4 items-center text-xs font-medium text-success" aria-live="polite">
        {saving === name ? <Loader2 className="size-3.5 animate-spin text-ink-tertiary" aria-label="Saving"/> : saved === name ? <motion.span initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="inline-flex items-center gap-1"><Check className="size-3.5" aria-hidden/>Saved</motion.span> : null}
      </span>);
    const checks = [
        { ok: readiness.milestonesTotal > 0 && readiness.milestonesDelivered === readiness.milestonesTotal, text: readiness.milestonesTotal === 0 ? "Add at least one milestone" : `Milestones delivered · ${readiness.milestonesDelivered} of ${readiness.milestonesTotal}` },
        { ok: readiness.tasksAccepted === readiness.tasksTotal, text: `Work accepted · ${readiness.tasksAccepted} of ${readiness.tasksTotal}` },
    ];

    return (<Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full gap-0 border-line bg-canvas p-0 sm:max-w-md">
        <SheetHeader className="border-b border-line px-6 pt-6 pb-4">
          <SheetTitle className="text-lg font-semibold tracking-[-0.02em] text-ink">Project settings</SheetTitle>
          <SheetDescription className="text-sm text-ink-tertiary">Changes save as you leave each field.</SheetDescription>
        </SheetHeader>
        <div className="grid gap-5 overflow-y-auto p-4 pb-10">
          <section aria-labelledby="settings-details" className="grid gap-4 rounded-2xl material p-5">
            <h3 id="settings-details" className="text-[15px] font-semibold text-ink">Details</h3>
            <label className="grid gap-1.5">
              <span className="flex items-center text-xs font-medium text-ink-secondary">Title{mark("title")}</span>
              <input defaultValue={project.title} disabled={closed} onBlur={(e) => void save("title", e.target.value)} className={cn(field, "h-11")}/>
            </label>
            <label className="grid gap-1.5">
              <span className="flex items-center text-xs font-medium text-ink-secondary">Description{mark("description")}</span>
              <textarea defaultValue={project.description ?? ""} disabled={closed} rows={3} onBlur={(e) => void save("description", e.target.value)} placeholder="What this project covers" className={cn(field, "resize-y py-2.5 leading-relaxed")}/>
            </label>
            <div className="grid grid-cols-2 gap-3">
              <label className="grid gap-1.5">
                <span className="flex items-center text-xs font-medium text-ink-secondary">Starts{mark("start_date")}</span>
                <input type="date" defaultValue={project.start_date} disabled={closed} onChange={(e) => void save("start_date", e.target.value)} className={cn(field, "h-11")}/>
              </label>
              <label className="grid gap-1.5">
                <span className="flex items-center text-xs font-medium text-ink-secondary">Ends{mark("end_date")}</span>
                <input type="date" defaultValue={project.end_date} disabled={closed} onChange={(e) => void save("end_date", e.target.value)} className={cn(field, "h-11")}/>
              </label>
            </div>
          </section>

          <section ref={closeRef} aria-labelledby="settings-close" className="scroll-mt-4 grid gap-4 rounded-2xl material p-5">
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-ink-tertiary" aria-hidden/>
              <h3 id="settings-close" className="text-[15px] font-semibold text-ink">{closed ? "Closed project" : "Close project"}</h3>
            </div>
            {closed ? (<>
                <p className="text-sm leading-relaxed text-ink-secondary">This project is closed and read-only. The client sees its handover record. Reopening lets work move again.</p>
                {confirmReopen ? (<div className="flex flex-wrap gap-2">
                    <button type="button" disabled={busy} onClick={() => void reopen()} className={cn(primaryAction, "h-10")}>{busy ? <Loader2 className="animate-spin" aria-hidden/> : null}Yes, reopen it</button>
                    <button type="button" onClick={() => setConfirmReopen(false)} className={cn(softAction, "h-10 px-4")}>Keep it closed</button>
                  </div>) : <button type="button" onClick={() => setConfirmReopen(true)} className={cn(softAction, "h-10 w-fit px-4")}>Reopen project</button>}
              </>) : (<>
                <ul className="grid gap-2">
                  {checks.map((c, i) => (<motion.li key={c.text} initial={reduce ? false : { opacity: 0, x: -8 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: 0.1 + i * 0.12 }} className="flex items-center gap-2.5 text-sm">
                      <span className={cn("grid size-6 shrink-0 place-items-center rounded-full", c.ok ? "bg-success-soft text-success" : "bg-surface-sunken text-ink-tertiary")} aria-hidden>{c.ok ? <Check className="size-3.5" strokeWidth={3}/> : <X className="size-3.5" strokeWidth={3}/>}</span>
                      <span className={c.ok ? "text-ink" : "text-ink-secondary"}>{c.text}</span>
                      <span className="sr-only">{c.ok ? "done" : "not yet"}</span>
                    </motion.li>))}
                </ul>
                <label className="grid gap-1.5">
                  <span className="text-xs font-medium text-ink-secondary">Closing statement · shown to the client</span>
                  <textarea value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} className={cn(field, "resize-y py-2.5 text-sm leading-relaxed")}/>
                </label>
                <button type="button" disabled={!readiness.ready || busy} onClick={() => void close()} className={cn(primaryAction, "h-11 justify-center disabled:opacity-50")}>
                  {busy ? <Loader2 className="animate-spin" aria-hidden/> : <Lock aria-hidden/>}
                  {readiness.ready ? "Close and hand over" : "Not ready to close yet"}
                </button>
              </>)}
          </section>

          <section ref={deleteRef} aria-labelledby="settings-delete" className="scroll-mt-4 grid gap-4 rounded-2xl border border-danger/25 bg-danger-soft/40 p-5">
            <div className="flex items-center gap-2">
              <Trash2 className="size-4 text-danger" aria-hidden/>
              <h3 id="settings-delete" className="text-[15px] font-semibold text-danger">Delete project</h3>
            </div>
            <p className="text-sm leading-relaxed text-ink-secondary">
              This removes <b className="font-medium text-ink">{project.title}</b> for everyone, for good: {tasks.length} {tasks.length === 1 ? "task" : "tasks"}, {milestones.length} {milestones.length === 1 ? "milestone" : "milestones"}, every photo, file, message and log entry. The client and crew lose access at once. {closed ? "" : "To keep a record instead, close the project."}
            </p>
            <label className="grid gap-1.5">
              <span className="text-xs font-medium text-ink-secondary">Type <b className="font-semibold text-ink select-all">{project.title}</b> to confirm</span>
              <input value={confirmName} onChange={(e) => setConfirmName(e.target.value)} onKeyDown={(e) => e.key === "Enter" && void remove()} autoComplete="off" spellCheck={false} aria-describedby="settings-delete" className={cn(field, "h-11 focus:border-danger focus:shadow-[0_0_0_4px_rgb(195_38_46/0.14)]")}/>
            </label>
            <button type="button" disabled={confirmName.trim() !== project.title.trim() || deleting} onClick={() => void remove()} className={cn("press inline-flex h-11 cursor-pointer items-center justify-center gap-2 rounded-full bg-danger px-5 text-sm font-medium text-white transition-opacity duration-300 hover:bg-danger/90 disabled:cursor-not-allowed disabled:opacity-40", focusRing)}>
              {deleting ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Trash2 className="size-4" aria-hidden/>}
              {deleting ? "Deleting…" : "Delete this project"}
            </button>
          </section>
        </div>
      </SheetContent>
    </Sheet>);
}
