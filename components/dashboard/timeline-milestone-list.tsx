"use client";
import Link from "next/link";
import { CalendarRange, CheckCircle2, Circle, Flag, PlayCircle, } from "lucide-react";
import { formatDisplayDate, formatRelativeDueDate, getMilestoneStatus, MILESTONE_STATUS_LABELS, todayIso, type MilestoneStatus, } from "@/lib/milestone-utils";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/types/database";
const STATUS_STYLES: Record<MilestoneStatus, string> = {
    completed: "border-emerald-200 bg-emerald-50 text-emerald-800",
    overdue: "border-red-200 bg-red-50 text-red-800",
    due_soon: "border-amber-200 bg-amber-50 text-amber-900",
    upcoming: "border-slate-200 bg-slate-50 text-slate-600",
};
const DOT_STYLES: Record<MilestoneStatus, string> = {
    completed: "bg-emerald-600 ring-emerald-100",
    overdue: "bg-red-500 ring-red-100",
    due_soon: "bg-amber-500 ring-amber-100",
    upcoming: "bg-slate-400 ring-slate-100",
};
type TimelineMilestoneListProps = {
    milestones: Milestone[];
    projectStart: string;
    projectEnd: string;
    isClient?: boolean;
};
function sortMilestones(items: Milestone[]): Milestone[] {
    return [...items].sort((a, b) => a.due_date.localeCompare(b.due_date));
}
export function TimelineMilestoneList({ milestones, projectStart, projectEnd, isClient = false, }: TimelineMilestoneListProps) {
    const sorted = sortMilestones(milestones);
    const today = todayIso();
    if (sorted.length === 0)
        return null;
    type Row = {
        type: "anchor";
        label: string;
        date: string;
        icon: "start" | "end";
    } | {
        type: "today";
    } | {
        type: "milestone";
        data: Milestone;
    };
    const rows: Row[] = [{ type: "anchor", label: "Project starts", date: projectStart, icon: "start" }];
    let todayInserted = false;
    for (const m of sorted) {
        if (!todayInserted && m.due_date >= today) {
            rows.push({ type: "today" });
            todayInserted = true;
        }
        rows.push({ type: "milestone", data: m });
    }
    if (!todayInserted) {
        rows.push({ type: "today" });
    }
    rows.push({ type: "anchor", label: "Target completion", date: projectEnd, icon: "end" });
    return (<div className={cn("border bg-white p-5 sm:p-6", isClient ? "border-stone-200/90" : "border-slate-200")}>
      <p className={cn("mb-5 font-mono text-[10px] uppercase tracking-[0.2em]", isClient ? "text-stone-500" : "text-slate-500")}>
        Phase schedule — read top to bottom
      </p>

      <ol className="relative space-y-0">
        {rows.map((row, idx) => {
            if (row.type === "anchor") {
                return (<li key={`anchor-${row.icon}`} className="relative flex gap-4 pb-6">
                <div className="flex flex-col items-center">
                  <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2", row.icon === "start"
                        ? "border-[#d97706]/40 bg-[#d97706]/10 text-[#9a4f02]"
                        : "border-slate-300 bg-slate-100 text-slate-600")}>
                    {row.icon === "start" ? (<PlayCircle className="h-4 w-4"/>) : (<Flag className="h-4 w-4"/>)}
                  </div>
                  {idx < rows.length - 1 ? (<div className="mt-1 w-px flex-1 bg-slate-200" aria-hidden/>) : null}
                </div>
                <div className="min-w-0 pb-1 pt-1">
                  <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-400">
                    {row.label}
                  </p>
                  <p className="font-medium text-slate-900">{formatDisplayDate(row.date)}</p>
                </div>
              </li>);
            }
            if (row.type === "today") {
                return (<li key="today-marker" className="relative flex gap-4 py-2">
                <div className="flex w-8 shrink-0 justify-center">
                  <div className="h-full w-px bg-slate-200" aria-hidden/>
                </div>
                <div className="flex flex-1 items-center gap-3 py-1">
                  <div className="h-px flex-1 bg-[#d97706]/40"/>
                  <span className="shrink-0 rounded-full bg-[#d97706] px-3 py-1 font-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-white">
                    Today · {formatDisplayDate(today)}
                  </span>
                  <div className="h-px flex-1 bg-[#d97706]/40"/>
                </div>
              </li>);
            }
            const m = row.data;
            const status = getMilestoneStatus(m);
            return (<li key={m.id} className="relative flex gap-4 pb-6">
              <div className="flex flex-col items-center">
                <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-full ring-4", DOT_STYLES[status])}>
                  {m.completed ? (<CheckCircle2 className="h-4 w-4 text-white"/>) : (<Circle className="h-4 w-4 text-white/90"/>)}
                </div>
                <div className="mt-1 w-px flex-1 bg-slate-200" aria-hidden/>
              </div>
              <div className={cn("min-w-0 flex-1 rounded-lg border p-4", status === "overdue" && !m.completed && "border-red-200/80 bg-red-50/30", status === "due_soon" && !m.completed && "border-amber-200/80 bg-amber-50/20", m.completed && "border-emerald-100 bg-emerald-50/20", status === "upcoming" && "border-slate-100 bg-slate-50/50")}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 space-y-1">
                    <p className={cn("font-medium leading-snug text-slate-900", m.completed && "text-slate-500 line-through")}>
                      {m.title}
                    </p>
                    <p className="text-sm text-slate-600">
                      Due {formatDisplayDate(m.due_date)}
                      <span className="mx-1.5 text-slate-300">·</span>
                      <span className={cn(status === "overdue" && !m.completed && "font-medium text-red-700", status === "due_soon" && !m.completed && "font-medium text-amber-800")}>
                        {formatRelativeDueDate(m.due_date, m.completed)}
                      </span>
                    </p>
                  </div>
                  <span className={cn("shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[9px] uppercase tracking-[0.14em]", STATUS_STYLES[status])}>
                    {MILESTONE_STATUS_LABELS[status]}
                  </span>
                </div>
              </div>
            </li>);
        })}
      </ol>
    </div>);
}
export function TimelineStats({ milestones, isClient = false, }: {
    milestones: Milestone[];
    projectEnd?: string;
    isClient?: boolean;
}) {
    const completed = milestones.filter((m) => m.completed).length;
    const overdue = milestones.filter((m) => !m.completed && getMilestoneStatus(m) === "overdue").length;
    const dueSoon = milestones.filter((m) => !m.completed && getMilestoneStatus(m) === "due_soon").length;
    const cards = [
        { label: "Phases", value: milestones.length },
        { label: "Completed", value: completed },
        { label: "Overdue", value: overdue, alert: overdue > 0 },
        { label: "Due this week", value: dueSoon, warn: dueSoon > 0 },
    ];
    return (<div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {cards.map((c) => (<div key={c.label} className={cn("border p-3", isClient ? "border-stone-100 bg-stone-50/80" : "border-slate-100 bg-slate-50/80", c.alert && "border-red-200 bg-red-50/60", c.warn && !c.alert && "border-amber-200 bg-amber-50/50")}>
          <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
            {c.label}
          </p>
          <p className="mt-1 font-heading text-2xl tabular-nums text-slate-950">{c.value}</p>
        </div>))}
    </div>);
}
export function TimelineEmptyState({ viewerRole, projectId, }: {
    viewerRole: string;
    projectId: string;
}) {
    const isPm = viewerRole === "project_manager";
    const isClient = viewerRole === "client";
    return (<div className={cn("flex flex-col items-center gap-4 border border-dashed px-6 py-14 text-center", isClient ? "border-stone-200 bg-stone-50/50" : "border-slate-200 bg-slate-50/40")}>
      <CalendarRange className="h-10 w-10 text-slate-300"/>
      <div className="max-w-md space-y-2">
        <p className="font-heading text-lg text-slate-900">No phases scheduled yet</p>
        <p className="text-sm leading-relaxed text-slate-500">
          {isPm
            ? "Add milestones below or from the Overview tab. They will appear here as a simple schedule and on the calendar view."
            : isClient
                ? "Your project manager will add delivery checkpoints here. You will see each phase and due date as the project progresses."
                : "Your project manager defines phases and dates. Check back here for the schedule, and use the Board for your daily tasks."}
        </p>
      </div>
      {!isPm && !isClient ? (<Link href={`/projects/${projectId}/board`} className="font-mono text-[10px] uppercase tracking-[0.18em] text-[#9a4f02] hover:text-[#d97706]">
          Go to Board for your tasks →
        </Link>) : null}
    </div>);
}
