import Link from "next/link";
import { focusRing, OverviewCard } from "@/components/dashboard/overview-kit";
import { JourneyLine } from "@/components/projects/pm/journey-line";
import { projectPath } from "@/lib/constants";
import { milestoneFeed, type FeedState } from "@/lib/crew-project";
import type { CrewProjectData } from "@/lib/data/crew-project";
import { formatDate, plural } from "@/lib/dashboard";
import { journeyStations } from "@/lib/pm-project";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";

const STATE: Record<FeedState, { label: string; tone: string }> = {
    delivered: { label: "Delivered", tone: "bg-success-soft text-success" },
    late: { label: "Late", tone: "bg-danger-soft text-danger" },
    next: { label: "Next", tone: "bg-brand-soft text-brand" },
    upcoming: { label: "Upcoming", tone: "bg-surface-sunken text-ink-secondary" },
};
const DOT: Record<string, string> = { backlog: "bg-stage-todo", to_do: "bg-stage-todo", in_progress: "bg-stage-progress", review: "bg-stage-review", done: "bg-stage-done" };
const stageLabel = (stage: string) => TASK_STAGE_TERMS[(stage in TASK_STAGE_TERMS ? stage : "to_do") as keyof typeof TASK_STAGE_TERMS].label;

/** The project's milestones on the route, with where the viewer's own work sits in each. */
export function CrewSchedule({ data, viewerId }: {
    data: CrewProjectData;
    viewerId: string;
}) {
    const { project, milestones, tasks, today } = data;
    const feed = milestoneFeed(milestones, tasks, viewerId, today);
    if (feed.length === 0)
        return <p className="materialize rounded-[20px] material px-6 py-7 text-sm text-ink-secondary">Your project manager hasn&apos;t set milestones yet. They&apos;ll appear here with their dates.</p>;
    return (<div className="grid gap-5">
      <JourneyLine projectId={project.id} stations={journeyStations(milestones, tasks, today)} today={today} plain todayLabel="You are here"/>
      <OverviewCard id="milestones" title="Milestones" count={feed.length} className="materialize">
        <ol className="pb-2">
          {feed.map((m) => (<li key={m.id} className="border-t border-line px-5 py-4 first:border-t-0 sm:px-6">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className={cn("rounded-full px-2 py-0.5 text-[11px] font-semibold", STATE[m.state].tone)}>{STATE[m.state].label}</span>
                <span className="text-[15px] font-semibold text-ink">{m.title}</span>
                <span className="ml-auto text-xs text-ink-tertiary tabular">
                  Due {formatDate(m.due_date, { month: "short", day: "numeric" })}{m.total > 0 ? ` · ${m.accepted} of ${plural(m.total, "task")} accepted` : ""}
                </span>
              </div>
              {m.mine.length > 0 ? (<ul className="mt-2.5 flex flex-wrap gap-1.5" aria-label="Your tasks in this milestone">
                  {m.mine.map((t) => (<li key={t.id}>
                      <Link href={`${projectPath(project.id)}?task=${t.id}`} className={cn("inline-flex h-8 max-w-64 items-center gap-1.5 rounded-full bg-surface-sunken px-3 text-xs font-medium text-ink hover:bg-line", focusRing)}>
                        <span className={cn("size-1.5 shrink-0 rounded-full", DOT[t.stage] ?? "bg-stage-todo")} aria-hidden/>
                        <span className="truncate">{t.title}</span>
                        <span className="sr-only">, {stageLabel(t.stage)}</span>
                      </Link>
                    </li>))}
                </ul>) : <p className="mt-1.5 text-xs text-ink-tertiary">None of your tasks are in this milestone.</p>}
            </li>))}
        </ol>
      </OverviewCard>
    </div>);
}
