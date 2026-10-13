"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { softAction, stagger } from "@/components/dashboard/overview-kit";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { getErrorMessage } from "@/lib/utils";
import { reopenProject } from "@/services/project-service";

/** A closed project's Overview: what was delivered, the statement the client saw, and Reopen. */
export function ClosedRecord({ projectId, title, start, end, completedAt, statement, milestones, tasks, people }: {
    projectId: string;
    title: string;
    start: string;
    end: string;
    completedAt: string | null;
    statement: string | null;
    milestones: number;
    tasks: number;
    people: number;
}) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [busy, setBusy] = React.useState(false);
    const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });

    async function reopen() {
        setBusy(true);
        try {
            await reopenProject(projectId);
            setOpen(false);
            toast.success(`${title} is open again`);
            router.refresh();
        }
        catch (err) {
            toast.error(getErrorMessage(err));
        }
        finally {
            setBusy(false);
        }
    }

    return (<section aria-labelledby="closed-heading" className="materialize rounded-[20px] material p-5 sm:p-6" style={stagger(0)}>
      <div className="flex items-center gap-3">
        <span className="rounded-full bg-surface-sunken px-2.5 py-0.5 text-xs font-medium text-ink-secondary">{completedAt ? `Closed ${short(isoDateIn(completedAt))}` : "Closed"}</span>
        <span className="flex-1"/>
        <button type="button" onClick={() => setOpen(true)} className={softAction}>Reopen</button>
      </div>
      <h2 id="closed-heading" className="mt-4 text-[17px] font-semibold tracking-[-0.016em] text-ink">{title} was delivered</h2>
      <p className="mt-1 text-sm text-ink-tertiary">{short(start)} – {short(end)} · {plural(milestones, "milestone")} · {plural(tasks, "task")} · {people} {people === 1 ? "person" : "people"}</p>
      {statement ? <blockquote className="mt-4 border-l-[3px] border-copper pl-3 text-sm text-ink-secondary">{statement}</blockquote> : null}
      <p className="mt-4 text-xs text-ink-tertiary">Read-only. Board, Schedule and photos stay viewable.</p>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reopen {title}?</DialogTitle>
            <DialogDescription>The project returns to active delivery and the team can work on it again.</DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button>
            <Button disabled={busy} onClick={() => void reopen()}>{busy ? <Loader2 className="size-4 animate-spin" aria-hidden/> : "Reopen"}</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>);
}
