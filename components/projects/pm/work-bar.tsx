import Link from "next/link";
import { focusRing, OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import type { StageCounts } from "@/lib/dashboard";
import { projectBoardPath, projectReviewPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";

const STAGES = [
    { key: "to_do", colour: "bg-stage-todo" },
    { key: "in_progress", colour: "bg-stage-progress" },
    { key: "review", colour: "bg-stage-review" },
    { key: "done", colour: "bg-stage-done" },
] as const;

/** Every task by stage as one bar. Each stage opens the work it counts. */
export function WorkBar({ projectId, stages, total }: {
    projectId: string;
    stages: StageCounts;
    total: number;
}) {
    const href = (key: keyof StageCounts) => (key === "review" ? projectReviewPath(projectId) : projectBoardPath(projectId, { view: "all", stage: key }));
    return (<OverviewCard id="project-work" title="Work" aside={total > 0 ? "Choose a stage to open it" : undefined} className="materialize" style={stagger(3)}>
      {total === 0 ? <p className="px-6 pt-1 pb-5 text-sm text-ink-tertiary">No tasks yet.</p> : (<div className="px-5 pt-2 pb-4 sm:px-6">
          <div className="flex h-3 gap-0.5" aria-hidden>
            {STAGES.map((s) => (stages[s.key] > 0 ? <Link key={s.key} href={href(s.key)} tabIndex={-1} className={cn("rounded-full transition-[flex-grow,scale] duration-700 ease-spring hover:scale-y-150", s.colour)} style={{ flexGrow: stages[s.key] }}/> : null))}
          </div>
          <ul className="mt-3 grid grid-cols-2 gap-1">
            {STAGES.map((s) => (<li key={s.key}>
                <Link href={href(s.key)} className={cn("flex items-center gap-2 rounded-xl px-2.5 py-2 text-sm transition-colors duration-300 ease-spring hover:bg-surface-sunken", focusRing)}>
                  <span className={cn("size-2 rounded-full", s.colour)} aria-hidden/>
                  <span className="text-ink-secondary">{TASK_STAGE_TERMS[s.key].label}</span>
                  <span className="ml-auto font-semibold text-ink tabular">{stages[s.key]}</span>
                </Link>
              </li>))}
          </ul>
        </div>)}
    </OverviewCard>);
}
