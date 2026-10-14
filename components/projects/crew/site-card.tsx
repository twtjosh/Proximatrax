"use client";
import { MessageSquare } from "lucide-react";
import { Face, OverviewCard, softAction } from "@/components/dashboard/overview-kit";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import type { SiteNext } from "@/lib/crew-project";
import type { TeamMember } from "@/lib/data/project-context";
import { formatDate, plural } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";

/** The site around the viewer's work: the next milestone and how their tasks feed it, then who is on the project. */
export function SiteCard({ projectId, next, team, viewerId }: {
    projectId: string;
    next: SiteNext | null;
    team: TeamMember[];
    viewerId: string;
}) {
    const pm = team.find((m) => m.role === ROLE_TERMS.project_manager);
    const crew = team.filter((m) => m.role === ROLE_TERMS.middleman);
    return (<OverviewCard id="this-site" title="This site" className="materialize lg:sticky lg:top-[calc(var(--frame-stick,0px)+1.5rem)]">
      <div className="px-5 pb-5 sm:px-6">
        {next ? (<div className="rounded-2xl bg-surface-subtle p-4 ring-1 ring-line">
            <p className="text-xs font-medium text-ink-tertiary">Next milestone</p>
            <p className="mt-0.5 text-[15px] font-semibold text-ink">{next.title}</p>
            <p className={cn("text-xs tabular", next.days < 0 ? "font-medium text-danger" : "text-ink-secondary")}>
              Due {formatDate(next.due_date, { month: "short", day: "numeric" })} · {next.days < 0 ? `${plural(-next.days, "day")} late` : next.days === 0 ? "today" : `in ${plural(next.days, "day")}`}
            </p>
            <p className="mt-2 text-xs text-ink-secondary">{next.mine === 0 ? "None of your tasks are part of it." : `${next.mine} of your ${next.mine === 1 ? "tasks is" : "tasks are"} part of it.`}</p>
          </div>) : <p className="rounded-2xl bg-surface-subtle p-4 text-sm text-ink-secondary ring-1 ring-line">No milestones to work toward yet.</p>}

        <p className="mt-5 text-xs font-medium text-ink-tertiary">People</p>
        <ul className="mt-1 grid">
          {pm ? (<li className="flex items-center gap-3 py-2">
              <Face person={pm} size={34}/>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-ink">{pm.name}</span>
                <span className="block text-xs text-ink-tertiary">{pm.role}</span>
              </span>
              <OpenChatButton projectId={projectId} className={cn(softAction, "h-9")}><MessageSquare aria-hidden/>Message</OpenChatButton>
            </li>) : null}
          {crew.map((m) => (<li key={m.id} className="flex items-center gap-3 py-2">
              <Face person={m} size={34}/>
              <span className="min-w-0 flex-1 leading-tight">
                <span className="block truncate text-sm font-medium text-ink">{m.name}{m.id === viewerId ? <span className="font-normal text-ink-tertiary"> (you)</span> : null}</span>
                <span className="block text-xs text-ink-tertiary">{m.role}</span>
              </span>
            </li>))}
        </ul>
      </div>
    </OverviewCard>);
}
