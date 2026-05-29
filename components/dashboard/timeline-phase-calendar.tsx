"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CalendarRange, CheckCircle2, ChevronRight, Circle, Loader2, Pencil, } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { projectPath } from "@/lib/constants";
import { formatDisplayDate, formatRelativeDueDate, getMilestoneStatus, MILESTONE_STATUS_LABELS, todayIso, type MilestoneStatus, } from "@/lib/milestone-utils";
import { logActivity } from "@/services/activity-service";
import { updateMilestone } from "@/services/project-service";
import { cn } from "@/lib/utils";
import type { Milestone } from "@/types/database";
import type { UserRole } from "@/types/enums";
const STATUS_PILL: Record<MilestoneStatus, string> = {
    completed: "bg-emerald-50 text-emerald-700 ring-emerald-200/80",
    overdue: "bg-red-50 text-red-700 ring-red-200/80",
    due_soon: "bg-amber-50 text-amber-800 ring-amber-200/80",
    upcoming: "bg-slate-100 text-slate-600 ring-slate-200/80",
};
const BAR_COLOR: Record<MilestoneStatus, string> = {
    completed: "bg-emerald-500",
    overdue: "bg-red-500",
    due_soon: "bg-amber-500",
    upcoming: "bg-slate-400",
};
const DOT_RING: Record<MilestoneStatus, string> = {
    completed: "bg-emerald-500 ring-emerald-100",
    overdue: "bg-red-500 ring-red-100",
    due_soon: "bg-amber-500 ring-amber-100",
    upcoming: "bg-slate-500 ring-slate-100",
};
function dayIndex(date: string, origin: string): number {
    const a = new Date(`${origin}T00:00:00`).getTime();
    const b = new Date(`${date}T00:00:00`).getTime();
    return Math.round((b - a) / 86400000);
}
function clampPct(n: number): number {
    return Math.min(100, Math.max(0, n));
}
function dateToPct(date: string, windowStart: string, totalDays: number): number {
    return clampPct((dayIndex(date, windowStart) / totalDays) * 100);
}
function sortMilestones(items: Milestone[]): Milestone[] {
    return [...items].sort((a, b) => a.due_date.localeCompare(b.due_date));
}
function buildMonthColumns(windowStart: string, windowEnd: string) {
    const cols: Array<{
        label: string;
        key: string;
        startPct: number;
        widthPct: number;
    }> = [];
    const start = new Date(`${windowStart}T00:00:00`);
    const end = new Date(`${windowEnd}T00:00:00`);
    const totalMs = end.getTime() - start.getTime() || 1;
    const cursor = new Date(start.getFullYear(), start.getMonth(), 1);
    while (cursor <= end) {
        const monthStart = new Date(cursor);
        const monthEnd = new Date(cursor.getFullYear(), cursor.getMonth() + 1, 0);
        const segStart = monthStart < start ? start : monthStart;
        const segEnd = monthEnd > end ? end : monthEnd;
        const startPct = clampPct(((segStart.getTime() - start.getTime()) / totalMs) * 100);
        const endPct = clampPct(((segEnd.getTime() - start.getTime()) / totalMs) * 100);
        cols.push({
            key: `${cursor.getFullYear()}-${cursor.getMonth()}`,
            label: cursor.toLocaleDateString(undefined, { month: "short" }),
            startPct,
            widthPct: Math.max(endPct - startPct, 0),
        });
        cursor.setMonth(cursor.getMonth() + 1);
    }
    return cols;
}
export type TimelinePhaseCalendarProps = {
    projectId: string;
    projectStart: string;
    projectEnd: string;
    milestones: Milestone[];
    viewerRole: UserRole;
    isClient?: boolean;
};
export function TimelinePhaseCalendar({ projectId, projectStart, projectEnd, milestones, viewerRole, isClient = false, }: TimelinePhaseCalendarProps) {
    const router = useRouter();
    const isPm = viewerRole === "project_manager";
    const sorted = sortMilestones(milestones);
    const totalDays = Math.max(1, dayIndex(projectEnd, projectStart));
    const today = todayIso();
    const todayPct = dateToPct(today, projectStart, totalDays);
    const todayInWindow = today >= projectStart && today <= projectEnd;
    const monthCols = React.useMemo(() => buildMonthColumns(projectStart, projectEnd), [projectEnd, projectStart]);
    const rows = React.useMemo(() => sorted.map((m) => ({
        milestone: m,
        status: getMilestoneStatus(m),
        duePct: dateToPct(m.due_date, projectStart, totalDays),
    })), [projectStart, sorted, totalDays]);
    const [editTarget, setEditTarget] = React.useState<Milestone | null>(null);
    const [editDate, setEditDate] = React.useState("");
    const [saving, setSaving] = React.useState(false);
    function openEdit(m: Milestone) {
        if (!isPm)
            return;
        setEditTarget(m);
        setEditDate(m.due_date);
    }
    async function saveDate() {
        if (!editTarget || !editDate)
            return;
        setSaving(true);
        try {
            await updateMilestone({ id: editTarget.id, due_date: editDate });
            await logActivity({
                project_id: projectId,
                action_type: "milestone_rescheduled",
                details: {
                    milestone_id: editTarget.id,
                    title: editTarget.title,
                    due_date: editDate,
                },
            });
            toast.success("Due date updated");
            setEditTarget(null);
            router.refresh();
        }
        catch (e) {
            toast.error(e instanceof Error ? e.message : "Update failed.");
        }
        finally {
            setSaving(false);
        }
    }
    if (sorted.length === 0) {
        return (<div className="flex flex-col items-center gap-3 rounded-xl border border-dashed border-slate-200 bg-slate-50/50 px-6 py-14 text-center">
        <CalendarRange className="h-9 w-9 text-slate-300"/>
        <p className="font-heading text-base text-slate-800">No phases scheduled yet</p>
        <p className="max-w-sm text-sm text-slate-500">
          {isPm
                ? "Add milestones on Overview — they appear here on the schedule."
                : "Your project manager adds phases from Overview."}
        </p>
        {isPm ? (<Link href={projectPath(projectId)} className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-[#9a4f02] hover:text-[#d97706]">
            Go to Overview
            <ChevronRight className="h-4 w-4"/>
          </Link>) : null}
      </div>);
    }
    return (<div className={cn("overflow-hidden rounded-xl border shadow-sm", isClient ? "border-stone-200/90 bg-white" : "border-slate-200 bg-white")}>
      
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 px-5 py-3.5">
        <div>
          <p className="text-sm font-semibold text-slate-900">Schedule roadmap</p>
          <p className="text-xs text-slate-500">
            {formatDisplayDate(projectStart)} – {formatDisplayDate(projectEnd)}
          </p>
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1">
          {(Object.entries(MILESTONE_STATUS_LABELS) as [
            MilestoneStatus,
            string
        ][]).map(([key, label]) => (<span key={key} className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                <span className={cn("h-2 w-2 rounded-full", BAR_COLOR[key])}/>
                {label}
              </span>))}
        </div>
      </div>

      
      <div className="hidden md:block">
        <div className="overflow-x-auto">
          <div className="min-w-[560px]">
            
            <div className="flex border-b border-slate-100">
              <div className="w-[252px] shrink-0 border-r border-slate-100 bg-slate-50/80 px-4 py-2.5">
                <span className="text-[11px] font-medium uppercase tracking-wider text-slate-400">
                  Phase
                </span>
              </div>
              <div className="relative flex h-9 flex-1">
                {monthCols.map((col) => (<div key={col.key} className="absolute inset-y-0 flex items-center border-l border-slate-100/90 pl-2" style={{ left: `${col.startPct}%`, width: `${col.widthPct}%` }}>
                    <span className="text-[11px] font-medium uppercase tracking-wide text-slate-400">
                      {col.label}
                    </span>
                  </div>))}
              </div>
            </div>

            
            <div className="relative">
              
              {todayInWindow ? (<div className="pointer-events-none absolute inset-0 z-10 flex">
                  <div className="w-[252px] shrink-0"/>
                  <div className="relative flex-1">
                    <div className="absolute inset-y-0 w-px bg-[#d97706]/75" style={{ left: `${todayPct}%` }}/>
                    <span className="absolute left-0 top-0 z-10 -translate-x-1/2 rounded-full bg-[#d97706] px-2 py-0.5 text-[10px] font-semibold text-white shadow-sm" style={{ left: `${todayPct}%` }}>
                      Today
                    </span>
                  </div>
                </div>) : null}

              {rows.map(({ milestone: m, status, duePct }, idx) => (<div key={m.id} className={cn("flex border-b border-slate-50 last:border-b-0", idx % 2 === 1 && "bg-slate-50/40")}>
                  
                  <button type="button" onClick={() => openEdit(m)} disabled={!isPm} className={cn("w-[252px] shrink-0 border-r border-slate-100 px-4 py-3.5 text-left transition-colors", isPm && "hover:bg-slate-50", !isPm && "cursor-default")}>
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium tabular-nums text-slate-500">
                        {idx + 1}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-1.5">
                          {m.completed ? (<CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600"/>) : (<Circle className="h-3.5 w-3.5 shrink-0 text-slate-300"/>)}
                          <p className={cn("truncate text-sm font-medium leading-snug", m.completed ? "text-slate-500" : "text-slate-900")}>
                            {m.title}
                          </p>
                        </div>
                        <p className="mt-1 text-xs text-slate-500">
                          {formatDisplayDate(m.due_date)} ·{" "}
                          {formatRelativeDueDate(m.due_date, m.completed)}
                        </p>
                        <span className={cn("mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", STATUS_PILL[status])}>
                          {MILESTONE_STATUS_LABELS[status]}
                        </span>
                      </div>
                    </div>
                  </button>

                  
                  <div className="relative flex min-h-[76px] flex-1 items-center px-3">
                    {monthCols.map((col) => (<div key={col.key} className="pointer-events-none absolute inset-y-2 border-l border-slate-100/70" style={{ left: `${col.startPct}%` }}/>))}

                    
                    <div className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-slate-100" style={{ left: "0%", width: `${duePct}%` }}>
                      <div className={cn("h-full rounded-full", BAR_COLOR[status])} title={`${m.title} — due ${formatDisplayDate(m.due_date)}`}/>
                    </div>

                    
                    <div className="absolute top-1/2 z-1 -translate-x-1/2 -translate-y-1/2" style={{ left: `${duePct}%` }}>
                      <div className={cn("h-3.5 w-3.5 rounded-full ring-4", DOT_RING[status])}/>
                    </div>
                  </div>
                </div>))}
            </div>
          </div>
        </div>
      </div>

      
      <div className="divide-y divide-slate-100 md:hidden">
        {rows.map(({ milestone: m, status, duePct }, idx) => (<button key={m.id} type="button" onClick={() => openEdit(m)} disabled={!isPm} className={cn("w-full px-4 py-4 text-left", isPm && "active:bg-slate-50", !isPm && "cursor-default")}>
            <div className="flex items-start justify-between gap-3">
              <div className="flex min-w-0 items-start gap-2">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-slate-100 text-[10px] font-medium text-slate-500">
                  {idx + 1}
                </span>
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">{m.title}</p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    {formatDisplayDate(m.due_date)} ·{" "}
                    {formatRelativeDueDate(m.due_date, m.completed)}
                  </p>
                </div>
              </div>
              <span className={cn("shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ring-1 ring-inset", STATUS_PILL[status])}>
                {MILESTONE_STATUS_LABELS[status]}
              </span>
            </div>
            <div className="relative mt-3 h-1.5 overflow-hidden rounded-full bg-slate-100">
              {todayInWindow ? (<div className="absolute inset-y-0 z-10 w-px bg-[#d97706]" style={{ left: `${todayPct}%` }}/>) : null}
              <div className={cn("absolute inset-y-0 left-0 rounded-full", BAR_COLOR[status])} style={{ width: `${duePct}%` }}/>
            </div>
          </button>))}
      </div>

      <div className="border-t border-slate-100 bg-slate-50/50 px-5 py-2.5 text-xs text-slate-500">
        {isPm ? (<div className="flex flex-wrap items-center justify-between gap-2">
            <span>Each row shows time from project start to the phase due date.</span>
            <Link href={projectPath(projectId)} className="font-medium text-[#9a4f02] hover:text-[#d97706]">
              Add or complete phases on Overview →
            </Link>
          </div>) : (<span>
            {isClient
                ? "Major phases only — see the Progress board for individual tasks."
                : "Schedule reference — daily work is on the Board tab."}
          </span>)}
      </div>

      <Dialog open={editTarget !== null} onOpenChange={(o) => !o && setEditTarget(null)}>
        <DialogContent className="sm:max-w-sm">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 font-heading text-lg">
              <Pencil className="h-4 w-4 text-[#d97706]"/>
              Reschedule phase
            </DialogTitle>
          </DialogHeader>
          {editTarget ? (<div className="space-y-4">
              <p className="text-sm font-medium text-slate-800">{editTarget.title}</p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium text-slate-600">New due date</label>
                <Input type="date" value={editDate} onChange={(e) => setEditDate(e.target.value)}/>
              </div>
            </div>) : null}
          <DialogFooter className="gap-2">
            <Button type="button" variant="outline" onClick={() => setEditTarget(null)}>
              Cancel
            </Button>
            <Button type="button" disabled={saving || !editDate} className="bg-[#d97706] text-slate-950 hover:bg-[#ef9b27]" onClick={() => void saveDate()}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin"/> : "Save date"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>);
}
