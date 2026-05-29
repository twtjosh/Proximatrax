"use client";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { AlertCircle, Archive, CheckCircle2, ChevronDown, ChevronUp, Circle, Loader2, RotateCcw, ShieldCheck, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { assessProjectClosureReadiness, DEFAULT_COMPLETION_STATEMENT, type ClosureReadiness, } from "@/lib/project-lifecycle";
import { cn, getErrorMessage } from "@/lib/utils";
import { completeProject, reopenProject } from "@/services/project-service";
import type { Milestone, Project } from "@/types/database";
import type { TaskStage } from "@/types/enums";
type ProjectClosurePanelProps = {
    project: Project;
    milestones: Milestone[];
    tasks: Array<{
        stage: TaskStage;
    }>;
    canManage: boolean;
    completedByUserId: string;
    closedByName?: string | null;
};
function ReadinessRow({ ok, label, detail, }: {
    ok: boolean;
    label: string;
    detail: string;
}) {
    const Icon = ok ? CheckCircle2 : Circle;
    return (<li className="flex items-start gap-2.5 text-sm">
      <Icon className={cn("mt-0.5 h-4 w-4 shrink-0", ok ? "text-emerald-600" : "text-slate-300")} aria-hidden/>
      <div>
        <p className={cn("font-medium", ok ? "text-slate-900" : "text-slate-600")}>
          {label}
        </p>
        <p className="text-xs text-slate-500">{detail}</p>
      </div>
    </li>);
}
export function ProjectClosurePanel({ project, milestones, tasks, canManage, completedByUserId, closedByName, }: ProjectClosurePanelProps) {
    const router = useRouter();
    const isClosed = project.status === "completed";
    const readiness: ClosureReadiness = assessProjectClosureReadiness(project, milestones, tasks);
    const [statement, setStatement] = useState(project.completion_statement ?? DEFAULT_COMPLETION_STATEMENT);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [closeOpen, setCloseOpen] = useState(false);
    const [reopenOpen, setReopenOpen] = useState(false);
    const [expanded, setExpanded] = useState(false);
    if (!canManage && !isClosed)
        return null;
    async function handleClose() {
        setBusy(true);
        setError(null);
        try {
            await completeProject(project.id, completedByUserId, statement);
            setCloseOpen(false);
            router.refresh();
        }
        catch (err) {
            setError(getErrorMessage(err));
        }
        finally {
            setBusy(false);
        }
    }
    async function handleReopen() {
        setBusy(true);
        setError(null);
        try {
            await reopenProject(project.id);
            setReopenOpen(false);
            router.refresh();
        }
        catch (err) {
            setError(getErrorMessage(err));
        }
        finally {
            setBusy(false);
        }
    }
    if (isClosed) {
        return (<>
        <section className="rounded-2xl border border-emerald-200/80 bg-linear-to-br from-emerald-50/80 to-white p-6 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700 ring-1 ring-emerald-200/80">
                <Archive className="h-5 w-5" aria-hidden/>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-emerald-800/80">
                  Formal closure record
                </p>
                <h2 className="mt-1 font-heading text-lg font-semibold text-slate-950">
                  Engagement closed
                </h2>
                {project.completed_at ? (<p className="mt-1 text-sm text-slate-600">
                    Closed{" "}
                    {new Date(project.completed_at).toLocaleDateString(undefined, {
                    month: "long",
                    day: "numeric",
                    year: "numeric",
                })}
                    {closedByName ? ` · ${closedByName}` : ""}
                  </p>) : null}
              </div>
            </div>
            {canManage ? (<Button type="button" variant="outline" disabled={busy} onClick={() => setReopenOpen(true)} className="h-9 rounded-lg border-slate-200 text-sm">
                <RotateCcw className="mr-1.5 h-3.5 w-3.5"/>
                Reopen engagement
              </Button>) : null}
          </div>
          {project.completion_statement ? (<blockquote className="mt-5 border-l-2 border-emerald-300/80 pl-4 text-sm leading-relaxed text-slate-700 italic">
              {project.completion_statement}
            </blockquote>) : null}
          {error ? (<p className="mt-4 flex items-center gap-2 text-sm text-red-700">
              <AlertCircle className="h-4 w-4 shrink-0"/>
              {error}
            </p>) : null}
        </section>

        <Dialog open={reopenOpen} onOpenChange={setReopenOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reopen this engagement?</DialogTitle>
              <DialogDescription>
                The project will return to active delivery. Team members can resume
                board work and phase updates. Use only if closure was premature.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setReopenOpen(false)}>
                Cancel
              </Button>
              <Button disabled={busy} onClick={() => void handleReopen()}>
                {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : "Reopen"}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </>);
    }
    if (!expanded) {
        return (<section className={cn("rounded-xl border px-4 py-3.5 transition-colors", readiness.ready
                ? "border-emerald-200/80 bg-emerald-50/30"
                : "border-dashed border-slate-200/90 bg-slate-50/50")}>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex min-w-0 items-start gap-3">
            <div className={cn("mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg", readiness.ready
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-500")}>
              <ShieldCheck className="h-4 w-4" aria-hidden/>
            </div>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="text-sm font-medium text-slate-800">
                  Formal project closure
                </p>
                {readiness.ready ? (<span className="inline-flex items-center rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-emerald-800">
                    Ready
                  </span>) : null}
              </div>
              <p className="mt-0.5 text-xs leading-relaxed text-slate-500">
                {readiness.ready
                ? "All phases and tasks are complete — open the closure workflow when you want to archive this engagement."
                : "Hidden until you need it. Opens the checklist and closure statement when delivery is finished."}
              </p>
            </div>
          </div>
          <Button type="button" variant="outline" onClick={() => setExpanded(true)} className={cn("h-9 shrink-0 gap-1.5 rounded-lg text-sm", readiness.ready
                ? "border-emerald-200/90 bg-white text-emerald-900 hover:bg-emerald-50"
                : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50")}>
            {readiness.ready ? "Close engagement" : "Open closure workflow"}
            <ChevronDown className="h-3.5 w-3.5 opacity-60" aria-hidden/>
          </Button>
        </div>
      </section>);
    }
    return (<>
      <section className="rounded-2xl border border-slate-200/90 bg-white p-6 shadow-sm">
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-start gap-3">
            <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-slate-900 text-white">
              <ShieldCheck className="h-5 w-5" aria-hidden/>
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-mono text-[10px] uppercase tracking-[0.18em] text-slate-500">
                Formal closure
              </p>
              <h2 className="mt-1 font-heading text-lg font-semibold text-slate-950">
                Close engagement
              </h2>
              <p className="mt-1 max-w-2xl text-sm leading-relaxed text-slate-600">
                When every phase is delivered and all board work is accepted, formally
                close this project. It moves to the completed archive for all roles and
                becomes read-only.
              </p>
            </div>
          </div>
          <Button type="button" variant="ghost" onClick={() => setExpanded(false)} className="h-9 shrink-0 gap-1.5 rounded-lg text-xs text-slate-500 hover:text-slate-800">
            Hide
            <ChevronUp className="h-3.5 w-3.5" aria-hidden/>
          </Button>
        </div>

        <ul className="mt-5 space-y-3 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
          <ReadinessRow ok={readiness.milestonesTotal > 0 &&
            readiness.milestonesDelivered === readiness.milestonesTotal} label="All phases delivered" detail={`${readiness.milestonesDelivered} of ${readiness.milestonesTotal} milestones stamped`}/>
          <ReadinessRow ok={readiness.tasksTotal === 0 ||
            readiness.tasksAccepted === readiness.tasksTotal} label="All board work accepted" detail={`${readiness.tasksAccepted} of ${readiness.tasksTotal} tasks in Accepted`}/>
        </ul>

        {readiness.blockers.length > 0 ? (<div className="mt-4 rounded-lg border border-amber-200/80 bg-amber-50/60 px-4 py-3 text-sm text-amber-950">
            <p className="font-medium">Before you can close</p>
            <ul className="mt-1 list-inside list-disc text-amber-900/90">
              {readiness.blockers.map((b) => (<li key={b}>{b}</li>))}
            </ul>
          </div>) : null}

        <div className="mt-5 space-y-2">
          <label htmlFor="completion-statement" className="text-xs font-medium uppercase tracking-wide text-slate-500">
            Closure statement (shared with client & team)
          </label>
          <textarea id="completion-statement" value={statement} onChange={(e) => setStatement(e.target.value)} rows={4} className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2.5 text-sm leading-relaxed text-slate-800 outline-none focus-visible:ring-2 focus-visible:ring-copper/30"/>
        </div>

        {error ? (<p className="mt-4 flex items-center gap-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4 shrink-0"/>
            {error}
          </p>) : null}

        <div className="mt-5">
          <Button type="button" disabled={!readiness.ready || busy} onClick={() => setCloseOpen(true)} className="h-10 rounded-lg bg-slate-900 px-5 text-sm font-medium text-white hover:bg-slate-800 disabled:opacity-50">
            {busy ? (<Loader2 className="mr-2 h-4 w-4 animate-spin"/>) : (<Archive className="mr-2 h-4 w-4"/>)}
            Formally close engagement
          </Button>
        </div>
      </section>

      <Dialog open={closeOpen} onOpenChange={setCloseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Formally close this engagement?</DialogTitle>
            <DialogDescription>
              This action archives the project for every role. Board moves, phase
              edits, and task changes will be locked until you reopen the engagement.
            </DialogDescription>
            <p className="rounded-md border border-slate-200 bg-slate-50 p-3 text-xs leading-relaxed text-slate-700">
              {statement.trim() || DEFAULT_COMPLETION_STATEMENT}
            </p>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCloseOpen(false)}>
              Cancel
            </Button>
            <Button disabled={busy} onClick={() => void handleClose()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin"/> : "Close & archive"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>);
}
