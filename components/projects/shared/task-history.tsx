"use client";
import * as React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { Loader2 } from "lucide-react";
import { logDetail, logKind, logSentence, type LogKind } from "@/lib/project-log";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { listProjectActivityPage, type ActivityWithActor } from "@/services/activity-service";

export const KIND_DOT: Record<LogKind, string> = {
    update: "bg-brand",
    review: "bg-stage-review",
    task: "bg-stage-progress",
    schedule: "bg-copper",
    file: "bg-ink-tertiary",
    discussion: "bg-stage-todo",
    team: "bg-stage-done",
};
const when = (iso: string) => new Intl.DateTimeFormat("en-PH", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Everything that happened to one task, newest first: who moved, sent back, uploaded or said what. */
export function TaskHistory({ projectId, taskId }: {
    projectId: string;
    taskId: string;
}) {
    const reduce = useReducedMotion();
    const [rows, setRows] = React.useState<ActivityWithActor[] | null>(null);
    React.useEffect(() => {
        let live = true;
        listProjectActivityPage(projectId, { limit: 40, taskId }).then((r) => live && setRows(r)).catch(() => live && setRows([]));
        return () => {
            live = false;
        };
    }, [projectId, taskId]);

    if (rows === null)
        return <p className="flex items-center gap-2 text-sm text-ink-tertiary"><Loader2 className="size-4 animate-spin" aria-hidden/>Loading history…</p>;
    if (rows.length === 0)
        return <p className="rounded-2xl border border-dashed border-line px-6 py-8 text-center text-sm text-ink-tertiary">Nothing has happened to this task yet.</p>;
    return (<ol className="relative grid gap-4 before:absolute before:top-2 before:bottom-2 before:left-[5px] before:w-px before:bg-line">
      {rows.map((r, i) => {
            const detail = logDetail(r);
            return (<motion.li key={r.id} initial={reduce ? false : { opacity: 0, x: -6 }} animate={{ opacity: 1, x: 0 }} transition={{ ...SPRING, delay: Math.min(i, 10) * 0.03 }} className="relative flex gap-3.5">
            <span className={cn("relative mt-1.5 size-[11px] shrink-0 rounded-full ring-4 ring-canvas", KIND_DOT[logKind(r)])} aria-hidden/>
            <div className="min-w-0 text-sm">
              <p className="text-ink-secondary"><b className="font-semibold text-ink">{r.actor?.full_name ?? "Someone"}</b> {logSentence(r)}</p>
              {detail ? <p className="mt-1 rounded-xl bg-surface-sunken px-3 py-2 text-[13px] text-ink">{detail}</p> : null}
              <p className="mt-0.5 text-xs text-ink-tertiary tabular">{when(r.created_at)}</p>
            </div>
          </motion.li>);
        })}
    </ol>);
}
