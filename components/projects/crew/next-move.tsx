"use client";
import { ArrowRight, Loader2, Play, RotateCcw, Send } from "lucide-react";
import { focusRing, primaryAction } from "@/components/dashboard/overview-kit";
import { nextHandoffAction } from "@/lib/board-workflow";
import { daysBetween, duePhrase, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import type { TaskWithRelations } from "@/services/task-service";

/**
 * The one thing to do on this project now, with the button that does it.
 * Work that needs hands first (sent back, or a submit with no photo yet)
 * opens the task instead of moving it.
 */
export function NextMove({ task, today, sentBack, photoCount, busy, viewerId, onAdvance, onOpen }: {
    task: TaskWithRelations;
    today: string;
    sentBack: boolean;
    photoCount: number;
    busy: boolean;
    viewerId: string;
    onAdvance: () => void;
    onOpen: () => void;
}) {
    const handoff = nextHandoffAction(task, "middleman", viewerId);
    const late = task.due_date ? daysBetween(task.due_date, today) : 0;
    const needsHands = sentBack || (handoff?.variant === "submit" && photoCount === 0);
    const why = sentBack ? "Sent back by your project manager" : late > 0 ? `${plural(late, "day")} late` : task.stage === "in_progress" ? "In progress" : "Ready to start";
    const tone = sentBack ? "text-brand" : late > 0 ? "text-danger" : "text-ink-tertiary";
    const label = sentBack ? "Fix & resubmit" : needsHands ? "Add a photo" : handoff?.variant === "submit" ? "Submit for review" : "Start work";
    const Icon = sentBack ? RotateCcw : needsHands ? ArrowRight : handoff?.variant === "submit" ? Send : Play;
    return (<section aria-label="Your next move here" className="materialize flex flex-wrap items-center gap-4 rounded-[20px] material p-4 sm:flex-nowrap sm:p-5">
      <span aria-hidden className={cn("grid size-11 shrink-0 place-items-center rounded-full", sentBack ? "bg-brand-soft text-brand" : late > 0 ? "bg-danger-soft text-danger" : "bg-surface-sunken text-ink")}>
        <Icon className="size-5"/>
      </span>
      <button type="button" onClick={onOpen} className={cn("min-w-0 flex-1 rounded-lg text-left", focusRing)}>
        <span className={cn("block text-xs font-medium", tone)}>Your next move here · {why}</span>
        <span className="block truncate text-[17px] font-semibold tracking-[-0.016em] text-ink">{task.title}</span>
        <span className="block truncate text-xs text-ink-tertiary">{task.milestone?.title ?? "No milestone"}{task.due_date ? ` · due ${duePhrase(task.due_date, today)}` : ""}</span>
      </button>
      <button type="button" disabled={busy} onClick={needsHands ? onOpen : onAdvance} className={cn(primaryAction, "h-11 max-sm:w-full max-sm:justify-center disabled:opacity-60")}>
        {busy ? <Loader2 className="animate-spin" aria-hidden/> : <Icon aria-hidden/>}
        {label}
      </button>
    </section>);
}
