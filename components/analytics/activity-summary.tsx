"use client";
import * as React from "react";
import { Download } from "lucide-react";
import { asMember } from "@/components/analytics/marks";
import { KIND } from "@/components/analytics/timeline/timeline-parts";
import { Segmented } from "@/components/analytics/timeline/project-timeline";
import { Face, OverviewCard, softAction, stagger } from "@/components/dashboard/overview-kit";
import { addDays, isoDateIn } from "@/lib/dashboard";
import { LOG_KINDS, logDetail, logKind, logSentence } from "@/lib/project-log";
import type { TimelineEntry, TimelinePerson } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";

type Range = "7" | "30" | "all";
const RANGES: { value: Range; label: string }[] = [{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "all", label: "All time" }];
const time = (instant: string) => new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(instant));
const capital = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/**
 * The PM's activity log in numbers: how much happened across their projects
 * in the range, by type, by person and by project, against the same span
 * before. Descriptive only. The rows behind it download as CSV.
 */
export function ActivitySummary({ log, people, projects, today }: {
    log: TimelineEntry[];
    people: Record<string, TimelinePerson>;
    projects: { id: string; title: string }[];
    today: string;
}) {
    const [range, setRange] = React.useState<Range>("30");
    const s = React.useMemo(() => {
        const days = range === "all" ? null : Number(range);
        const from = days ? addDays(today, 1 - days) : "";
        const before = days ? addDays(from, -days) : "";
        const rows = log.filter((e) => isoDateIn(e.created_at) >= from);
        const prev = days ? log.filter((e) => { const d = isoDateIn(e.created_at); return d >= before && d < from; }).length : null;
        const tally = <K extends string>(key: (e: TimelineEntry) => K | null) => {
            const m = new Map<K, number>();
            for (const e of rows) {
                const k = key(e);
                if (k) m.set(k, (m.get(k) ?? 0) + 1);
            }
            return [...m].sort((a, b) => b[1] - a[1]);
        };
        return { rows, prev, kinds: tally(logKind), people: tally((e) => e.user_id ?? null).slice(0, 6), projects: tally((e) => e.project_id).slice(0, 6) };
    }, [log, range, today]);

    const titleOf = new Map(projects.map((p) => [p.id, p.title]));
    const total = s.rows.length, diff = s.prev === null ? null : total - s.prev;
    const download = () => {
        const cell = (v: string) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
        const lines = [["Date", "Time", "Project", "Person", "Role", "Type", "Activity", "Note"].join(",")];
        for (const e of s.rows) {
            const who = e.user_id ? people[e.user_id] : undefined;
            lines.push([isoDateIn(e.created_at), time(e.created_at), titleOf.get(e.project_id) ?? "", who?.name ?? "Someone", who?.role ?? "", LOG_KINDS.find((k) => k.kind === logKind(e))?.label ?? "", capital(logSentence(e)), logDetail(e) ?? ""].map(cell).join(","));
        }
        // A BOM so Excel reads the curly quotes and accents as UTF-8.
        const url = URL.createObjectURL(new Blob([`﻿${lines.join("\r\n")}`], { type: "text/csv;charset=utf-8" }));
        Object.assign(document.createElement("a"), { href: url, download: `activity-log-${range === "all" ? "all-time" : `last-${range}-days`}-${today}.csv` }).click();
        URL.revokeObjectURL(url);
    };

    return (<OverviewCard id="activity-heading" title="Activity" sub="What happened across your projects, by type, person and project" className="materialize mt-4" style={stagger(4)} aside={<span className="flex flex-wrap items-center gap-2">
        <Segmented label="Activity range" value={range} onChange={(v) => setRange(v as Range)} options={RANGES}/>
        <button type="button" onClick={download} disabled={total === 0} className={cn(softAction, "h-[38px] disabled:opacity-40")}><Download aria-hidden/>CSV</button>
      </span>}>
      <p className="px-5 pt-1 text-[13.5px] text-ink-secondary sm:px-6">
        <b className="font-semibold text-ink tabular">{total}</b> {total === 1 ? "activity" : "activities"}
        {diff === null ? null : diff === 0 ? " · same as the period before" : <> · <b className="font-semibold text-ink tabular">{Math.abs(diff)}</b> {diff > 0 ? "more" : "fewer"} than the {range} days before</>}
      </p>
      {total === 0 ? <p className="px-5 pt-3 pb-6 text-sm text-ink-tertiary sm:px-6">Nothing logged in this range.</p> : (<div className="grid gap-6 px-5 pt-4 pb-5 sm:px-6 md:grid-cols-3">
          <Bars title="By type" rows={s.kinds.map(([k, n]) => ({ key: k, n, color: KIND[k].color, label: <span className="inline-flex items-center gap-2">{React.createElement(KIND[k].icon, { className: "size-3.5 text-ink-tertiary", "aria-hidden": true })}{KIND[k].label}</span> }))}/>
          <Bars title="Most active people" rows={s.people.map(([id, n]) => {
                const p = people[id];
                return { key: id, n, color: "var(--copper)", label: <span className="flex min-w-0 items-center gap-2"><Face person={asMember({ id, name: p?.name ?? "Someone", avatarUrl: p?.avatarUrl ?? null })} size={22}/><span className="min-w-0 truncate">{p?.name ?? "Someone"}<span className="text-ink-tertiary"> · {p?.role ?? ""}</span></span></span> };
            })}/>
          <Bars title="By project" rows={s.projects.map(([id, n]) => ({ key: id, n, color: "var(--series-2)", label: <span className="block truncate">{titleOf.get(id) ?? "Project"}</span> }))}/>
        </div>)}
    </OverviewCard>);
}

function Bars({ title, rows }: { title: string; rows: { key: string; n: number; color: string; label: React.ReactNode }[] }) {
    const max = Math.max(1, ...rows.map((r) => r.n));
    return (<section aria-label={title} className="min-w-0">
      <h3 className="mb-2.5 text-xs font-semibold text-ink-secondary">{title}</h3>
      <ul className="grid gap-2.5">
        {rows.map((r) => (<li key={r.key} className="grid gap-1 text-[13px]">
            <span className="flex items-center justify-between gap-3"><span className="min-w-0 text-ink">{r.label}</span><b className="font-semibold text-ink tabular">{r.n}</b></span>
            <span className="h-1.5 overflow-hidden rounded-full bg-surface-sunken" aria-hidden><span className="block h-full rounded-full" style={{ width: `${(r.n / max) * 100}%`, background: r.color }}/></span>
          </li>))}
      </ul>
    </section>);
}
