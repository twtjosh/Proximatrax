"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { agoPhrase, isoDateIn } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { HEALTH, type Health, type StatusUpdate } from "@/lib/project-log";
import { cn } from "@/lib/utils";
import { logActivity } from "@/services/activity-service";

/** Anything can ask for the composer: `window.dispatchEvent(new CustomEvent(POST_UPDATE_EVENT))`. */
export const POST_UPDATE_EVENT = "pm:post-update";
export const postUpdate = () => window.dispatchEvent(new CustomEvent(POST_UPDATE_EVENT));

export const HEALTH_STYLE: Record<Health, { dot: string; chip: string; on: string }> = {
    on_track: { dot: "bg-stage-done", chip: "bg-success-soft text-success", on: "bg-success text-white" },
    at_risk: { dot: "bg-stage-review", chip: "bg-warning-soft text-warning", on: "bg-warning text-white" },
    off_track: { dot: "bg-stage-late", chip: "bg-danger-soft text-danger", on: "bg-danger text-white" },
};
const PROMPTS: Record<Health, string> = {
    on_track: "What moved this week, what's next…",
    at_risk: "What's at risk and what you're doing about it…",
    off_track: "What slipped, the new plan, what you need from the client…",
};

/**
 * The PM's status update: how the project stands in one word and a few lines.
 * It heads the project's Overview and log, and the client sees it.
 */
export function StatusUpdateDialog({ projectId, last, suggested }: {
    projectId: string;
    last: StatusUpdate | null;
    /** The project's computed state, the starting choice when there is no update yet. */
    suggested: Health;
}) {
    const router = useRouter();
    const [open, setOpen] = React.useState(false);
    const [health, setHealth] = React.useState<Health>(last?.health ?? suggested);
    const [note, setNote] = React.useState("");
    const [busy, setBusy] = React.useState(false);

    React.useEffect(() => {
        const show = () => setOpen(true);
        window.addEventListener(POST_UPDATE_EVENT, show);
        return () => window.removeEventListener(POST_UPDATE_EVENT, show);
    }, []);

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!note.trim() || busy)
            return;
        setBusy(true);
        try {
            await logActivity({ project_id: projectId, action_type: "project_update", details: { health, note: note.trim() } });
            toast.success(`Posted: ${HEALTH[health].label}`, { description: "It heads the Overview, and the client sees it." });
            setNote("");
            setOpen(false);
            router.refresh();
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "That update didn't post. Try again.");
        }
        finally {
            setBusy(false);
        }
    }

    return (<Dialog open={open} onOpenChange={setOpen}>
      <DialogContent className="max-w-lg gap-5">
        <DialogHeader>
          <DialogTitle>Post a status update</DialogTitle>
          <DialogDescription>{last ? `Last update ${agoPhrase(isoDateIn(last.at), isoDateIn(new Date()))}: ${HEALTH[last.health].label}.` : "The first word on how this project stands."}</DialogDescription>
        </DialogHeader>
        <form onSubmit={submit} className="grid gap-4">
          <div role="radiogroup" aria-label="How the project stands" className="relative grid grid-cols-3 gap-1 rounded-2xl bg-surface-sunken p-1">
            {(Object.keys(HEALTH) as Health[]).map((h) => (<button key={h} type="button" role="radio" aria-checked={health === h} onClick={() => setHealth(h)} className={cn("relative isolate inline-flex h-10 cursor-pointer items-center justify-center gap-2 rounded-xl text-sm font-medium transition-colors duration-300", health === h ? "text-white" : "text-ink-secondary hover:text-ink", focusRing)}>
                {health === h ? <motion.span layoutId="health-pick" transition={SPRING} className={cn("absolute inset-0 -z-10 rounded-xl", HEALTH_STYLE[h].on)}/> : null}
                <span className={cn("size-2 rounded-full", health === h ? "bg-white" : HEALTH_STYLE[h].dot)} aria-hidden/>
                {HEALTH[h].label}
              </button>))}
          </div>
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">What the team and client should know
            <textarea autoFocus value={note} onChange={(e) => setNote(e.target.value)} onKeyDown={(e) => {
                if (e.key === "Enter" && (e.metaKey || e.ctrlKey))
                    void submit(e);
            }} rows={4} maxLength={1200} placeholder={PROMPTS[health]} className="field-sizing-content min-h-28 resize-none rounded-xl border border-line bg-surface px-3 py-2.5 text-sm leading-relaxed text-ink placeholder:text-ink-tertiary focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
          </label>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className={cn(softAction, "h-10 px-4 text-sm")}>Cancel</button>
            <button type="submit" disabled={!note.trim() || busy} className={cn(primaryAction, "disabled:opacity-50")}>{busy ? <Loader2 className="animate-spin" aria-hidden/> : null}Post update</button>
          </div>
        </form>
      </DialogContent>
    </Dialog>);
}
