import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { STAGE_LOOK, StageGlyph, StageHeading, type StageLook } from "@/components/system/stage-glyph";
import { projectBoardPath, projectReviewPath } from "@/lib/constants";
import { daysBetween, duePhrase, plural, type DashboardTask } from "@/lib/dashboard";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";

const LANES = [
    { stages: ["in_progress"], title: TASK_STAGE_TERMS.in_progress.label, look: STAGE_LOOK.in_progress },
    { stages: ["review"], title: TASK_STAGE_TERMS.review.label, look: STAGE_LOOK.review },
    { stages: ["to_do", "backlog"], title: TASK_STAGE_TERMS.to_do.label, look: STAGE_LOOK.to_do },
] as const;

/** Open tasks the PM gave themselves, soonest due first (undated last). */
export function ownOpenTasks(tasks: DashboardTask[], viewerId: string): DashboardTask[] {
    return tasks
        .filter((t) => t.assigned_to === viewerId && t.stage !== "done")
        .sort((a, b) => (a.due_date ?? "9999").localeCompare(b.due_date ?? "9999"));
}

/**
 * The PM's own work across every project, by stage. A row opens the task on
 * its board (In review opens Review mode). Hidden when the PM has none.
 */
export function YourTasks({ mine, titleOf, today }: {
    mine: DashboardTask[];
    titleOf: (id: string) => string;
    today: string;
}) {
    if (mine.length === 0)
        return null;
    const projectCount = new Set(mine.map((t) => t.project_id)).size;
    return (<OverviewCard id="your-tasks-heading" title="Your tasks" count={mine.length} aside={projectCount > 1 ? `Across ${projectCount} projects` : undefined} className="materialize" style={stagger(5)}>
      <div className="pb-2">
        {LANES.map((lane) => {
            const rows = mine.filter((t) => (lane.stages as readonly string[]).includes(t.stage));
            return rows.length > 0 ? (<section key={lane.title} aria-label={lane.title} className="mt-4 first:mt-1">
                <StageHeading look={lane.look} title={lane.title} count={rows.length}/>
                <ul>{rows.map((t) => <Row key={t.id} task={t} look={lane.look} project={titleOf(t.project_id)} today={today}/>)}</ul>
              </section>) : null;
        })}
      </div>
    </OverviewCard>);
}

function Row({ task, look, project, today }: {
    task: DashboardTask;
    look: StageLook;
    project: string;
    today: string;
}) {
    const late = task.due_date ? daysBetween(task.due_date, today) : 0;
    const href = task.stage === "review" ? `${projectReviewPath(task.project_id)}?task=${task.id}` : `${projectBoardPath(task.project_id)}?task=${task.id}`;
    return (<li className="border-t border-line first:border-t-0">
      <Link href={href} className={cn("group flex min-h-14 items-center gap-3 px-5 py-2.5 transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:px-6", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
        <StageGlyph look={look} className="mt-0.5 self-start"/>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{task.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-tertiary">
            <span className="truncate">{project}</span>
            {task.due_date ? <span className={cn("tabular", late > 0 ? "font-medium text-danger" : late >= -1 ? "font-medium text-brand" : "")}>{late > 0 ? `${plural(late, "day")} late` : `due ${duePhrase(task.due_date, today)}`}</span> : null}
          </span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-ink-tertiary transition-transform duration-300 ease-spring group-hover:translate-x-0.5" aria-hidden/>
      </Link>
    </li>);
}
