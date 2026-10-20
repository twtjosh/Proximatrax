"use client";
import Link from "next/link";
import { Face, focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { projectBoardPath } from "@/lib/constants";
import { daysBetween } from "@/lib/dashboard";
import type { TeamMember } from "@/lib/data/project-context";
import type { PmTask } from "@/lib/pm-project";
import { onSiteNow } from "@/lib/project-insights";
import { cn } from "@/lib/utils";

/** Work under way right now, by person: who is doing what, and since when. */
export function OnSiteNow({ projectId, tasks, team, today }: {
    projectId: string;
    tasks: PmTask[];
    team: TeamMember[];
    today: string;
}) {
    const groups = onSiteNow(tasks);
    const person = (id: string | null) => team.find((m) => m.id === id);
    return (<OverviewCard id="on-site" title="On site now" count={groups.reduce((n, g) => n + g.tasks.length, 0)} aside={<Link href={projectBoardPath(projectId, { stage: "in_progress" })} className={cn("rounded-sm font-medium text-ink-secondary hover:text-ink", focusRing)}>Board</Link>} className="materialize flex-1" style={stagger(5)}>
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
