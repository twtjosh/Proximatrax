"use client";
import * as React from "react";
import Link from "next/link";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Loader2, Megaphone } from "lucide-react";
import { Face, focusRing, primaryAction, softAction } from "@/components/dashboard/overview-kit";
import { KIND_DOT } from "@/components/projects/shared/task-history";
import { projectBoardPath, projectTimelinePath } from "@/lib/constants";
import { agoPhrase, formatDate, isoDateIn } from "@/lib/dashboard";
import type { TeamMember } from "@/lib/data/project-context";
import { SPRING } from "@/lib/motion";
import { HEALTH, isHealth, LOG_KINDS, logDetail, logKind, logSentence, type LogKind, type StatusUpdate } from "@/lib/project-log";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { listProjectActivityPage, type ActivityWithActor } from "@/services/activity-service";
import { HEALTH_STYLE, postUpdate } from "../status-update-dialog";

const PAGE = 40;
const time = (iso: string) => new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

/**
 * The project's log, the record the paper logbook used to be: every task
 * moved, accepted or sent back, every date changed, file added and comment
 * made, by whom and when. The PM's status updates head it.
 */
export function ProjectActivity({ projectId, initial, team, update, today, closed }: {
    projectId: string;
    initial: ActivityWithActor[];
    team: TeamMember[];
    update: StatusUpdate | null;
    today: string;
    closed: boolean;
}) {
    const reduce = useReducedMotion();
    const [rows, setRows] = React.useState(initial);
    const [seen, setSeen] = React.useState(initial);
    if (seen !== initial) {
        setSeen(initial);
        setRows((old) => merge(initial, old));
    }
    const [kind, setKind] = React.useState<LogKind | "all">("all");
    const [person, setPerson] = React.useState<string>("");
    const [more, setMore] = React.useState(initial.length === PAGE);
    const [loading, setLoading] = React.useState(false);

    // New rows arrive live.
    React.useEffect(() => {
        const sb = createClient();
        const channel = sb.channel(`project-log-${projectId}`)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "activity_feed", filter: `project_id=eq.${projectId}` }, () => {
                void listProjectActivityPage(projectId, { limit: 10 }).then((fresh) => setRows((old) => merge(fresh, old)));
            })
            .subscribe();
        return () => {
            void sb.removeChannel(channel);
        };
    }, [projectId]);

    async function loadMore() {
        const last = rows.at(-1);
        if (!last || loading)
            return;
        setLoading(true);
        try {
            const page = await listProjectActivityPage(projectId, { limit: PAGE, before: last.created_at });
            setRows((old) => merge(old, page));
            setMore(page.length === PAGE);
        }
        finally {
            setLoading(false);
        }
    }

    const shown = rows.filter((r) => (kind === "all" || logKind(r) === kind) && (!person || r.user_id === person));
    const days = new Map<string, ActivityWithActor[]>();
    for (const r of shown) {
        const d = isoDateIn(r.created_at);
        days.set(d, [...(days.get(d) ?? []), r]);
    }
    const dayLabel = (d: string) => (d === today ? "Today" : agoPhrase(d, today) === "yesterday" ? "Yesterday" : formatDate(d, { weekday: "long", month: "long", day: "numeric" }));

    return (<div className="grid gap-5 pt-2 lg:grid-cols-[minmax(0,1fr)_18rem] lg:items-start">
      <div className="grid min-w-0 gap-5">
        <section aria-label="Latest status update" className="materialize rounded-[22px] material p-5">
          {update ? (<>
              <div className="flex flex-wrap items-center gap-2">
                <span className={cn("inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold", HEALTH_STYLE[update.health].chip)}><span className={cn("size-1.5 rounded-full", HEALTH_STYLE[update.health].dot)} aria-hidden/>{HEALTH[update.health].label}</span>
                <span className="text-xs text-ink-tertiary">{team.find((m) => m.id === update.by)?.name ?? "The PM"} · {agoPhrase(isoDateIn(update.at), today)}</span>
                {!closed ? <button type="button" onClick={postUpdate} className={cn(softAction, "ml-auto h-8")}><Megaphone aria-hidden/>New update</button> : null}
              </div>
              <p className="mt-3 text-[15px] leading-relaxed text-pretty whitespace-pre-wrap text-ink">{update.note}</p>
            </>) : (<div className="flex flex-wrap items-center gap-4">
              <span className="grid size-11 place-items-center rounded-2xl bg-brand-soft text-brand"><Megaphone className="size-5" aria-hidden/></span>
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">No status update yet</p>
                <p className="text-sm text-ink-secondary">Say how the project stands in a word and a few lines. The team and the client see it.</p>
              </div>
              {!closed ? <button type="button" onClick={postUpdate} className={primaryAction}>Post update</button> : null}
            </div>)}
        </section>

        <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Show">
          {([{ kind: "all", label: "Everything" }, ...LOG_KINDS] as { kind: LogKind | "all"; label: string }[]).map((k) => (<button key={k.kind} type="button" aria-pressed={kind === k.kind} onClick={() => setKind(k.kind)} className={cn("relative isolate inline-flex h-8 cursor-pointer items-center gap-1.5 rounded-full px-3 text-xs font-medium transition-colors duration-300", kind === k.kind ? "text-white" : "bg-surface-sunken text-ink-secondary hover:text-ink", focusRing)}>
              {kind === k.kind ? <motion.span layoutId="log-kind" transition={SPRING} className="absolute inset-0 -z-10 rounded-full bg-ink"/> : null}
              {k.kind !== "all" ? <span className={cn("size-1.5 rounded-full", KIND_DOT[k.kind])} aria-hidden/> : null}
              {k.label}
            </button>))}
          <label className="relative ml-auto">
            <span className="sr-only">Person</span>
            <select value={person} onChange={(e) => setPerson(e.target.value)} className={cn("h-8 cursor-pointer appearance-none rounded-full border border-line bg-surface pr-7 pl-3 text-xs", person ? "border-ink font-medium text-ink" : "text-ink-secondary", focusRing)}>
              <option value="">Everyone</option>
              {team.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
            </select>
            <span aria-hidden className="pointer-events-none absolute top-1/2 right-2.5 -translate-y-1/2 text-[9px] text-ink-tertiary">▼</span>
          </label>
        </div>

        {shown.length === 0 ? <p className="rounded-[22px] border border-dashed border-line-strong px-6 py-12 text-center text-sm text-ink-secondary">{rows.length ? "Nothing of that kind in what's loaded." : "Nothing has happened on this project yet."}</p> : null}

        {[...days].map(([d, list]) => (<section key={d} aria-label={dayLabel(d)} className="grid gap-2">
            <h2 className="sticky top-[var(--frame-stick,0px)] z-10 -mx-1 bg-canvas/90 px-1 py-1.5 text-xs font-semibold text-ink-secondary backdrop-blur-md">{dayLabel(d)}</h2>
            <ol className="materialize overflow-hidden rounded-[22px] material">
              <AnimatePresence initial={false}>
                {list.map((r) => <Row key={r.id} r={r} projectId={projectId} reduce={!!reduce}/>)}
              </AnimatePresence>
            </ol>
          </section>))}

        {more ? <button type="button" onClick={() => void loadMore()} disabled={loading} className={cn(softAction, "mx-auto h-10 px-5 text-sm")}>{loading ? <Loader2 className="animate-spin" aria-hidden/> : null}Load earlier</button> : rows.length > 0 ? <p className="text-center text-xs text-ink-tertiary">That&apos;s everything since the project began.</p> : null}
      </div>

      <aside aria-label="Who did what" className="materialize grid gap-3 rounded-[22px] material p-5 lg:sticky lg:top-[calc(var(--frame-stick,0px)+1rem)]">
        <h2 className="text-sm font-semibold">In what&apos;s shown</h2>
        <ul className="grid gap-2.5">
          {LOG_KINDS.map((k) => {
            const n = rows.filter((r) => logKind(r) === k.kind && (!person || r.user_id === person)).length;
            return (<li key={k.kind} className="flex items-center gap-2.5 text-sm">
                <span className={cn("size-2 rounded-full", KIND_DOT[k.kind])} aria-hidden/>
                <span className="text-ink-secondary">{k.label}</span>
                <span className="ml-auto font-semibold text-ink tabular">{n}</span>
              </li>);
        })}
        </ul>
        <div className="border-t border-line pt-3">
          <p className="mb-2 text-xs font-medium text-ink-tertiary">Most active</p>
          <ul className="grid gap-2">
            {team.map((m) => ({ m, n: rows.filter((r) => r.user_id === m.id).length })).filter((x) => x.n).sort((a, b) => b.n - a.n).slice(0, 5).map(({ m, n }) => (<li key={m.id}>
                <button type="button" onClick={() => setPerson(person === m.id ? "" : m.id)} aria-pressed={person === m.id} className={cn("flex w-full cursor-pointer items-center gap-2.5 rounded-xl px-1.5 py-1 text-left text-sm hover:bg-surface-sunken", person === m.id && "bg-surface-sunken", focusRing)}>
                  <Face person={m} size={24}/>
                  <span className="min-w-0 flex-1 truncate">{m.name}</span>
                  <span className="text-xs text-ink-tertiary tabular">{n}</span>
                </button>
              </li>))}
          </ul>
        </div>
      </aside>
    </div>);
}

function Row({ r, projectId, reduce }: {
    r: ActivityWithActor;
    projectId: string;
    reduce: boolean;
}) {
    const d = r.details ?? {};
    const detail = logDetail(r);
    const href = typeof d.task_id === "string" ? `${projectBoardPath(projectId)}?task=${d.task_id}` : typeof d.milestone_id === "string" ? `${projectTimelinePath(projectId)}?milestone=${d.milestone_id}` : null;
    const isUpdate = r.action_type === "project_update" && isHealth(d.health);
    return (<motion.li layout={!reduce} initial={reduce ? false : { opacity: 0, y: -6 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={SPRING} className={cn("flex gap-3 border-b border-line px-4 py-3.5 last:border-b-0 sm:px-5", isUpdate && "bg-surface-subtle")}>
      <span className="relative flex h-fit shrink-0">
        <Face person={{ id: r.user_id ?? "x", name: r.actor?.full_name ?? "Someone", avatarUrl: r.actor?.avatar_url ?? null, role: "" }} size={30}/>
        <span className={cn("absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full ring-2 ring-surface", KIND_DOT[logKind(r)])} aria-hidden/>
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm text-ink-secondary">
          <b className="font-semibold text-ink">{r.actor?.full_name ?? "Someone"}</b> {isUpdate ? "posted a status update" : logSentence(r)}
          {isUpdate ? <span className={cn("ml-2 inline-flex items-center gap-1 rounded-full px-2 py-px align-[1px] text-[11px] font-semibold", HEALTH_STYLE[d.health as keyof typeof HEALTH_STYLE].chip)}>{HEALTH[d.health as keyof typeof HEALTH].label}</span> : null}
        </p>
        {detail ? <p className={cn("mt-1.5 rounded-xl px-3 py-2 text-[13px] leading-relaxed whitespace-pre-wrap text-ink", isUpdate ? "bg-surface" : "bg-surface-sunken")}>{detail}</p> : null}
      </div>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-xs text-ink-tertiary tabular">{time(r.created_at)}</span>
        {href ? <Link href={href} aria-label="Open" className={cn("grid size-7 place-items-center rounded-full text-ink-tertiary hover:bg-surface-sunken hover:text-ink", focusRing)}><ArrowUpRight className="size-3.5" aria-hidden/></Link> : null}
      </span>
    </motion.li>);
}

/** Newest first, no duplicates. */
function merge(a: ActivityWithActor[], b: ActivityWithActor[]) {
    const byId = new Map([...b, ...a].map((r) => [r.id, r]));
    return [...byId.values()].sort((x, y) => y.created_at.localeCompare(x.created_at));
}
