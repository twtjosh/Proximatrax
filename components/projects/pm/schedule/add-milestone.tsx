"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { toast } from "sonner";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { addDays, formatDate } from "@/lib/dashboard";
import { MILESTONE_SUGGESTIONS } from "@/lib/milestone-utils";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { createMilestone } from "@/services/project-service";
import type { Milestone } from "@/types/database";

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });

/** A name (or a common one) and a date; the date starts two weeks after the last milestone. */
export function AddMilestone({ projectId, existing, start, end, reduce, onDone }: {
    projectId: string;
    existing: Milestone[];
    start: string;
    end: string;
    reduce: boolean;
    onDone: (m: Milestone | null) => void;
}) {
    const last = existing.map((m) => m.due_date).sort().at(-1) ?? start;
    const proposed = addDays(last, 14);
    const [title, setTitle] = React.useState("");
    const [date, setDate] = React.useState(proposed > end ? end : proposed);
    const [busy, setBusy] = React.useState(false);
    const taken = new Set(existing.map((m) => m.title.toLowerCase()));
    const suggestions = MILESTONE_SUGGESTIONS.filter((s) => !taken.has(s.toLowerCase()));

    async function submit(e: React.FormEvent) {
        e.preventDefault();
        if (!title.trim() || !date || busy)
            return;
        setBusy(true);
        try {
            onDone(await createMilestone({ project_id: projectId, title: title.trim(), due_date: date }));
        }
        catch (err) {
            setBusy(false);
            toast.error(err instanceof Error ? err.message : "That milestone couldn't be added.");
        }
    }

    return (<motion.form initial={reduce ? false : { opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={SPRING} onSubmit={submit} onKeyDown={(e) => e.key === "Escape" && onDone(null)} className="overflow-hidden">
      <div className="grid gap-3 rounded-[24px] material p-4 sm:p-5">
        <div className="flex flex-wrap items-end gap-2.5">
          <label className="grid min-w-0 flex-1 basis-56 gap-1.5 text-xs font-medium text-ink-secondary">Name
            <input autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Roofing" className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink focus:border-brand focus:shadow-[0_0_0_4px_rgb(217_119_6/0.14)] focus:outline-none"/>
          </label>
          <label className="grid gap-1.5 text-xs font-medium text-ink-secondary">Due
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="h-10 rounded-xl border border-line bg-surface px-3 text-sm text-ink tabular focus:border-brand focus:outline-none"/>
          </label>
          <button type="button" onClick={() => onDone(null)} className={cn(softAction, "h-10 px-4")}>Cancel</button>
          <button type="submit" disabled={!title.trim() || busy} className={cn(primaryAction, "h-10 disabled:opacity-50")}>Add</button>
        </div>
        {suggestions.length > 0 ? (<div className="flex flex-wrap items-center gap-1.5 text-xs text-ink-tertiary">
            Common:
            {suggestions.map((s) => <button key={s} type="button" onClick={() => setTitle(s)} className={cn("press h-7 cursor-pointer rounded-full bg-surface-sunken px-3 font-medium text-ink-secondary hover:text-ink", focusRing)}>{s}</button>)}
          </div>) : null}
        {date > end ? <p className="text-xs text-warning">That&apos;s after the handover date ({short(end)}). Move the handover in Project settings if the project runs longer.</p> : null}
      </div>
    </motion.form>);
}
