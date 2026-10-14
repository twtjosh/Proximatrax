"use client";
import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Face, focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { KIND_DOT } from "@/components/projects/shared/task-history";
import { projectActivityPath, projectBoardPath } from "@/lib/constants";
import { agoPhrase, daysBetween, isoDateIn } from "@/lib/dashboard";
import type { TeamMember } from "@/lib/data/project-context";
import type { PmTask } from "@/lib/pm-project";
import { onSiteNow } from "@/lib/project-insights";
import { logDetail, logKind, logSentence } from "@/lib/project-log";
import { cn } from "@/lib/utils";
import type { ActivityWithActor } from "@/services/activity-service";

const time = (iso: string) => new Intl.DateTimeFormat("en-PH", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Manila" }).format(new Date(iso));

/** Work under way right now, by person: who is doing what, and since when. */
export function OnSiteNow({ projectId, tasks, team, today }: {
    projectId: string;
    tasks: PmTask[];
    team: TeamMember[];
    today: string;
}) {
    const groups = onSiteNow(tasks);
    const person = (id: string | null) => team.find((m) => m.id === id);
    return (<OverviewCard id="on-site" title="On site now" count={groups.reduce((n, g) => n + g.tasks.length, 0)} aside={<Link href={projectBoardPath(projectId, { stage: "in_progress" })} className={cn("rounded-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>Board</Link>} className="materialize" style={stagger(5)}>
      {groups.length === 0 ? <p className="px-6 pt-1 pb-6 text-sm text-ink-tertiary">No one has work under way. Start a task, or check who is free on Team.</p> : (<ul className="pb-2">
          {groups.map((g) => {
                const p = person(g.person);
                return (<li key={g.person ?? "none"} className="flex gap-3.5 border-t border-line px-5 py-3.5 first:border-t-0 sm:px-6">
                <Face person={p ?? { id: "none", name: "No one", avatarUrl: null, role: "" }} size={32}/>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-ink">{p?.name ?? "No one"}</p>
                  <ul className="mt-1 grid gap-1">
                    {g.tasks.map((t) => {
                            const late = t.due_date !== null && t.due_date < today;
                            return (<li key={t.id}>
                          <Link href={`${projectBoardPath(projectId)}?task=${t.id}`} className={cn("group flex items-center gap-2 rounded-md text-[13px]", focusRing)}>
                            <span className="size-1.5 shrink-0 rounded-full bg-stage-progress" aria-hidden/>
                            <span className="min-w-0 flex-1 truncate text-ink-secondary group-hover:text-ink group-hover:underline">{t.title}</span>
                            <span className={cn("shrink-0 text-xs tabular", late ? "font-semibold text-danger" : "text-ink-tertiary")}>{t.due_date ? (late ? `${daysBetween(t.due_date, today)}d late` : t.due_date === today ? "due today" : `due in ${daysBetween(today, t.due_date)}d`) : "no date"}</span>
                          </Link>
                        </li>);
                        })}
                  </ul>
                </div>
              </li>);
            })}
        </ul>)}
    </OverviewCard>);
}

/** The newest rows of the project log. */
export function RecentActivity({ projectId, rows, today }: {
    projectId: string;
    rows: ActivityWithActor[];
    today: string;
}) {
    return (<OverviewCard id="recent-activity" title="Recent activity" aside={<Link href={projectActivityPath(projectId)} className={cn("inline-flex items-center gap-0.5 rounded-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>Full log<ArrowUpRight className="size-3.5" aria-hidden/></Link>} className="materialize" style={stagger(6)}>
      {rows.length === 0 ? <p className="px-6 pt-1 pb-6 text-sm text-ink-tertiary">Nothing has happened yet.</p> : (<ol className="pb-2">
          {rows.slice(0, 7).map((r) => {
                const detail = logDetail(r);
                const d = isoDateIn(r.created_at);
                return (<li key={r.id} className="flex gap-3 px-5 py-2.5 sm:px-6">
                <span className="relative flex h-fit shrink-0">
                  <Face person={{ id: r.user_id ?? "x", name: r.actor?.full_name ?? "Someone", avatarUrl: r.actor?.avatar_url ?? null, role: "" }} size={26}/>
                  <span className={cn("absolute -right-0.5 -bottom-0.5 size-2 rounded-full ring-2 ring-surface", KIND_DOT[logKind(r)])} aria-hidden/>
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-[13px] leading-snug text-ink-secondary"><b className="font-semibold text-ink">{r.actor?.full_name.split(" ")[0] ?? "Someone"}</b> {logSentence(r)}</p>
                  {detail ? <p className="mt-0.5 truncate text-xs text-ink-tertiary">“{detail}”</p> : null}
                </div>
                <span className="shrink-0 text-[11px] text-ink-tertiary tabular">{d === today ? time(r.created_at) : agoPhrase(d, today)}</span>
              </li>);
            })}
        </ol>)}
    </OverviewCard>);
}
