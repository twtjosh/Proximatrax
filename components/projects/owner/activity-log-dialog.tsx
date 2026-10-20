"use client";
import * as React from "react";
import { Download, Loader2, Printer, X } from "lucide-react";
import { focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { Dialog, DialogClose, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { formatDate, isoDateIn, plural } from "@/lib/dashboard";
import type { PmProjectData } from "@/lib/data/pm-project";
import { LOG_KINDS, logDetail, logKind, logSentence } from "@/lib/project-log";
import { cn } from "@/lib/utils";
import { personTitle, PROJECT_STATUS_TERMS } from "@/lib/vocabulary";
import { listProjectLog, type LogActor } from "@/services/activity-service";
import type { ActivityFeedItem } from "@/types/database";

type Log = { rows: ActivityFeedItem[]; people: Record<string, LogActor> };

const longDay = (iso: string) => formatDate(iso, { weekday: "long", month: "long", day: "numeric", year: "numeric" });
const d = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });
const time = (instant: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(instant));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** One row as the report and the CSV say it. */
function line(r: ActivityFeedItem, people: Record<string, LogActor>) {
    const who = r.user_id ? people[r.user_id] : undefined;
    return {
        day: isoDateIn(r.created_at),
        time: time(r.created_at),
        name: who?.full_name ?? "Someone",
        role: who ? personTitle(who) : "",
        kind: LOG_KINDS.find((k) => k.kind === logKind(r))?.label ?? "",
        what: capital(logSentence(r)),
        note: logDetail(r) ?? "",
    };
}

function downloadCsv(title: string, log: Log) {
    const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
    const lines = [["Date", "Time", "Person", "Role", "Type", "Activity", "Note"].join(",")];
    for (const r of log.rows) {
        const l = line(r, log.people);
        lines.push([l.day, l.time, l.name, l.role, l.kind, l.what, l.note].map(cell).join(","));
    }
    // A BOM so Excel reads the curly quotes and accents as UTF-8.
    const url = URL.createObjectURL(new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
    const a = Object.assign(document.createElement("a"), { href: url, download: `${title.replace(/[^\w-]+/g, "-").replace(/-+/g, "-")}-activity-log.csv` });
    a.click();
    URL.revokeObjectURL(url);
}

/**
 * Everything that happened on a project, from creation to today, for the
 * super admin: a print preview of the whole log, oldest first and grouped by
 * day, to print, save as PDF or download as CSV. In-app chat is left out; it
 * is confidential.
 */
export function ActivityLogDialog({ open, onOpenChange, data }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    data: PmProjectData;
}) {
    const { project } = data;
    const [log, setLog] = React.useState<Log | null>(null);
    const [failed, setFailed] = React.useState(false);

    React.useEffect(() => {
        if (!open)
            return;
        let live = true;
        setLog(null);
        setFailed(false);
        listProjectLog(project.id).then((l) => { if (live) setLog(l); }, () => { if (live) setFailed(true); });
        return () => { live = false; };
    }, [open, project.id]);

    return (<Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent showCloseButton={false} className="top-[3vh] flex max-h-[94vh] translate-y-0 flex-col gap-0 overflow-hidden rounded-[20px] p-0 sm:max-w-[58rem] print:static print:max-h-none print:max-w-none print:translate-none print:animate-none print:overflow-visible print:rounded-none print:border-0 print:shadow-none">
        <div data-print-hide className="flex items-center gap-2.5 border-b border-line bg-surface px-5 py-3">
          <div className="min-w-0 flex-1">
            <DialogTitle className="truncate">Activity log</DialogTitle>
            <DialogDescription className="truncate text-[13px]">Every recorded action on this project, from start to today. In-app chat is not included.</DialogDescription>
          </div>
          <button type="button" disabled={!log} onClick={() => log && downloadCsv(project.title, log)} className={cn(softAction, "h-9 px-3.5 disabled:pointer-events-none disabled:opacity-60")}>
            <Download aria-hidden/><span className="max-sm:hidden">Download CSV</span><span className="sm:hidden">CSV</span>
          </button>
          <button type="button" disabled={!log} onClick={() => window.print()} className={cn(primaryAction, "h-9 px-4 disabled:pointer-events-none disabled:opacity-60")}>
            {log ? <Printer aria-hidden/> : <Loader2 className="animate-spin" aria-hidden/>}
            <span className="max-sm:hidden">Print or save PDF</span>
            <span className="sm:hidden">Print</span>
          </button>
          <DialogClose aria-label="Close activity log" className={cn("press grid size-9 shrink-0 cursor-pointer place-items-center rounded-full text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
            <X className="size-4" aria-hidden/>
          </DialogClose>
        </div>
        <div className="overflow-y-auto overscroll-contain bg-surface-sunken p-3 sm:p-8 print:overflow-visible print:bg-transparent print:p-0">
          {failed ? <p role="alert" className="mx-auto max-w-[52rem] rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">The activity log couldn’t be loaded. Close it and try again.</p>
            : log ? <ActivityLog data={data} log={log}/>
                : <div className="mx-auto grid h-64 max-w-[52rem] place-items-center rounded-[20px] bg-surface text-sm text-ink-tertiary shadow-card ring-1 ring-line"><span className="inline-flex items-center gap-2"><Loader2 className="size-4 animate-spin" aria-hidden/>Gathering every activity…</span></div>}
        </div>
      </DialogContent>
    </Dialog>);
}

function ActivityLog({ data, log }: { data: PmProjectData; log: Log }) {
    const { project, today } = data;
    const lines = log.rows.map((r) => line(r, log.people));
    const days = [...new Set(lines.map((l) => l.day))];
    const counts = LOG_KINDS.map((k) => ({ label: k.label, n: lines.filter((l) => l.kind === k.label).length })).filter((k) => k.n);
    const pm = data.team.find((m) => m.id === project.pm_id)?.name ?? "—";
    return (<article className="print-record mx-auto w-full max-w-[52rem] rounded-[20px] bg-surface p-8 text-ink shadow-card ring-1 ring-line sm:p-12 print:max-w-none print:rounded-none print:p-0 print:shadow-none print:ring-0">
      <header className="flex items-start justify-between gap-6 border-b-2 border-ink pb-5">
        <div>
          <p className="text-xs font-semibold tracking-[0.08em] text-ink-tertiary uppercase">Activity log</p>
          <h1 className="mt-1 text-[1.9rem] leading-tight font-semibold tracking-[-0.03em]">{project.title}</h1>
          <p className="mt-1 text-sm text-ink-secondary">For {project.client?.full_name ?? "the client"} · Project manager {pm}</p>
        </div>
        <div className="text-right text-xs text-ink-secondary">
          <p className="font-semibold text-ink">ProximaTrax</p>
          <p>AEG Home Fashion</p>
          <p className="mt-2">Generated {d(today)}</p>
        </div>
      </header>

      <section className="grid grid-cols-2 gap-4 border-b border-line py-5 sm:grid-cols-4">
        <Fact label="Schedule" value={`${d(project.start_date)} – ${d(project.end_date)}`}/>
        <Fact label="Status" value={PROJECT_STATUS_TERMS[project.status].label}/>
        <Fact label="Covers" value={days.length ? `${d(days[0])} – ${d(days[days.length - 1])}` : "Nothing yet"}/>
        <Fact label="Entries" value={`${lines.length} ${lines.length === 1 ? "activity" : "activities"} · ${plural(days.length, "day")}`}/>
      </section>
      {counts.length ? (<p className="border-b border-line py-3 text-xs text-ink-secondary">
          {counts.map((c, i) => <span key={c.label}>{i ? " · " : ""}<b className="font-semibold text-ink tabular">{c.n}</b> {c.label.toLowerCase()}</span>)}
          <span className="text-ink-tertiary"> · In-app chat is confidential and not included.</span>
        </p>) : null}

      {days.length === 0 ? <p className="py-10 text-center text-sm text-ink-tertiary">Nothing has been recorded on this project yet.</p> : days.map((day) => (<section key={day} className="pt-5 break-inside-avoid-page">
          <h2 className="border-b border-line pb-1.5 text-sm font-semibold">{longDay(day)}</h2>
          <table className="w-full text-[13px]">
            <tbody>
              {lines.filter((l) => l.day === day).map((l, i) => (<tr key={i} className="break-inside-avoid border-b border-line/60 align-top last:border-0">
                  <td className="w-[5.5rem] py-2 pr-3 text-ink-tertiary tabular whitespace-nowrap">{l.time}</td>
                  <td className="w-[11rem] py-2 pr-3"><span className="block font-medium">{l.name}</span><span className="block text-xs text-ink-tertiary">{l.role}</span></td>
                  <td className="py-2">
                    <span className="block">{l.what}</span>
                    {l.note ? <span className="mt-0.5 block text-xs text-ink-secondary">“{l.note}”</span> : null}
                  </td>
                  <td className="w-[6rem] py-2 pl-3 text-right text-xs text-ink-tertiary">{l.kind}</td>
                </tr>))}
            </tbody>
          </table>
        </section>))}
    </article>);
}

function Fact({ label, value }: { label: string; value: string }) {
    return (<div>
      <p className="text-xs text-ink-tertiary">{label}</p>
      <p className="mt-0.5 text-sm font-semibold">{value}</p>
    </div>);
}
