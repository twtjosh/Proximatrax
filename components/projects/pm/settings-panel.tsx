"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { Check, Loader2, Lock, X } from "lucide-react";
import { toast } from "sonner";
import { primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import type { DashboardMilestone } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { assessProjectClosureReadiness, DEFAULT_COMPLETION_STATEMENT } from "@/lib/project-lifecycle";
import { cn } from "@/lib/utils";
import { completeProject, reopenProject, updateProject, type ProjectWithRelations } from "@/services/project-service";

const field = "w-full rounded-xl border border-line bg-surface px-3.5 text-[15px] text-ink transition-[border-color,box-shadow] duration-300 ease-spring placeholder:text-ink-tertiary hover:border-line-strong focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none";

type Field = "title" | "description" | "start_date" | "end_date";

/**
 * The project's settings in one panel: its details, each saved on its own the
 * moment you leave the field, and closing (or reopening) the project, with
 * the checks that decide whether it can close.
 */
export function SettingsPanel({ open, onOpenChange, section, project, milestones, tasks, viewerId }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    /** "close" scrolls straight to Close project. */
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
    const readiness = assessProjectClosureReadiness(project, milestones, tasks as never);
    const closed = project.status === "completed";

    React.useEffect(() => {
        if (open && section === "close")
            requestAnimationFrame(() => closeRef.current?.scrollIntoView({ block: "start", behavior: "smooth" }));
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
        </div>
      </SheetContent>
    </Sheet>);
}
