"use client";
import * as React from "react";
import { Loader2 } from "lucide-react";
import { OverviewCard, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { duePhrase } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/services/task-service";

/**
 * Unassigned work on this project anyone on the crew may take. Taking is a
 * two-tap confirm: once a task is yours, only the project manager can hand it
 * to someone else.
 */
export function OpenWork({ tasks, today, busy, disabled, onTake }: {
    tasks: TaskWithRelations[];
    today: string;
    /** The task an action is running on, if any. */
    busy: string | null;
    disabled: boolean;
    onTake: (task: TaskWithRelations) => void;
}) {
    const [asking, setAsking] = React.useState<string | null>(null);
    return (<OverviewCard id="open-work" title="Open work" count={tasks.length} aside="Anyone on the crew can take these" className="materialize">
      <ul className="pb-2">
        {tasks.map((t) => {
            const confirming = asking === t.id;
            return (<li key={t.id} className="flex min-h-14 flex-wrap items-center gap-x-3 gap-y-2 border-t border-line px-5 py-2.5 first:border-t-0 sm:flex-nowrap sm:px-6">
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium text-ink">{t.title}</span>
                <span className="block truncate text-xs text-ink-tertiary">
                  {confirming ? "Only your project manager can reassign it after this." : <>{t.milestone?.title ?? "No milestone"}{t.due_date ? ` · due ${duePhrase(t.due_date, today)}` : ""}</>}
                </span>
              </span>
              {confirming ? (<span className="flex shrink-0 items-center gap-1.5 max-sm:w-full max-sm:justify-end">
                  <button type="button" onClick={() => setAsking(null)} className={cn(softAction, "h-10 px-4")}>Cancel</button>
                  <button type="button" onClick={() => { setAsking(null); onTake(t); }} className={cn(primaryAction, "h-10 px-4")}>Yes, it&apos;s mine</button>
                </span>) : (<button type="button" disabled={disabled || busy !== null} onClick={() => setAsking(t.id)} className={cn(softAction, "h-10 shrink-0 px-4 disabled:opacity-50")}>
                  {busy === t.id ? <Loader2 className="animate-spin" aria-hidden/> : null}
                  Take it
                </button>)}
            </li>);
        })}
      </ul>
    </OverviewCard>);
}
