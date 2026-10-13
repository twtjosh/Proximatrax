"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { primaryAction, stagger } from "@/components/dashboard/overview-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { plural } from "@/lib/dashboard";
import { DEFAULT_COMPLETION_STATEMENT } from "@/lib/project-lifecycle";
import { cn, getErrorMessage } from "@/lib/utils";
import { completeProject } from "@/services/project-service";

/** Shown the moment every milestone is delivered and all work accepted. */
export function CloseoutCard({ projectId, title, statement: saved, milestones, tasks, pmId }: {
    projectId: string;
    title: string;
    statement: string | null;
    milestones: number;
    tasks: number;
    pmId: string;
}) {
    const router = useRouter();
    const [statement, setStatement] = React.useState(saved ?? DEFAULT_COMPLETION_STATEMENT);
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const fieldId = React.useId();

    async function close() {
        setBusy(true);
        try {
            await completeProject(projectId, pmId, statement);
            setOpen(false);
            toast.success(`${title} is closed`);
            router.refresh();
        }
        catch (err) {
            toast.error(getErrorMessage(err));
        }
        finally {
            setBusy(false);
        }
    }

    return (<section aria-labelledby="closeout-heading" className="materialize rounded-[20px] material bg-linear-to-b from-surface to-success-soft/60 p-5 sm:p-6" style={stagger(0)}>
      <div className="flex items-center gap-3.5">
        <span className="grid size-10 place-items-center rounded-full bg-stage-done text-white" aria-hidden><Check className="size-5" strokeWidth={2.5}/></span>
        <div>
          <h2 id="closeout-heading" className="text-[17px] font-semibold tracking-[-0.016em] text-ink">Ready to close</h2>
          <p className="text-sm text-ink-tertiary">All {plural(milestones, "milestone")} delivered · all {plural(tasks, "task")} accepted</p>
        </div>
      </div>
      <label htmlFor={fieldId} className="mt-5 block text-xs font-medium text-ink-secondary">Completion statement (the client sees this)</label>
      <textarea id={fieldId} value={statement} onChange={(e) => setStatement(e.target.value)} rows={3} className="mt-1.5 w-full rounded-xl border border-line-strong bg-surface px-3 py-2 text-sm text-ink outline-none focus-visible:ring-2 focus-visible:ring-ring"/>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button type="button" onClick={() => setOpen(true)} className={primaryAction}>Close project</button>
        <span className="text-xs text-ink-tertiary">You can reopen it later.</span>
      </div>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Close {title}?</DialogTitle>
            <DialogDescription>It moves to Completed and becomes read-only for everyone. The client sees your completion statement.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy || !statement.trim()} onClick={() => void close()} className={cn(busy && "opacity-80")}>
              {busy ? <Loader2 className="size-4 animate-spin" aria-hidden/> : "Close project"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>);
}
