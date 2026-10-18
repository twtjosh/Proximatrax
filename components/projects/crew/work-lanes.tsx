"use client";
import * as React from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Camera, ChevronDown } from "lucide-react";
import { focusRing, OverviewCard } from "@/components/dashboard/overview-kit";
import { STAGE_LOOK, StageGlyph, StageHeading, type StageLook } from "@/components/system/stage-glyph";
import { checklistProgress } from "@/lib/board-workflow";
import type { CrewLanes } from "@/lib/crew-project";
import { daysBetween, duePhrase, plural } from "@/lib/dashboard";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import { TASK_STAGE_TERMS } from "@/lib/vocabulary";
import type { TaskWithRelations } from "@/services/task-service";

const LANES = [
    { key: "sentBack", title: "Sent back", hint: "Fix and resubmit", look: STAGE_LOOK.sent_back },
    { key: "inProgress", title: TASK_STAGE_TERMS.in_progress.label, hint: null, look: STAGE_LOOK.in_progress },
    { key: "review", title: TASK_STAGE_TERMS.review.label, hint: "Waiting on your project manager", look: STAGE_LOOK.review },
    { key: "toDo", title: TASK_STAGE_TERMS.to_do.label, hint: null, look: STAGE_LOOK.to_do },
] as const;

/**
 * The viewer's work on this project, by what it needs from them. A row opens
 * in place into its workbench, one at a time. Accepted work folds into a count.
 */
export function WorkLanes({ lanes, today, open, onToggle, photoCount, workbench }: {
    lanes: CrewLanes<TaskWithRelations>;
    today: string;
    open: string | null;
    onToggle: (id: string) => void;
    photoCount: (taskId: string) => number;
    workbench: (task: TaskWithRelations) => React.ReactNode;
}) {
    const [showAccepted, setShowAccepted] = React.useState(false);
    const openCount = lanes.sentBack.length + lanes.inProgress.length + lanes.review.length + lanes.toDo.length;
    return (<OverviewCard id="my-work" title="My work here" count={openCount} className="materialize">
      <div className="pb-2">
        {LANES.map((lane) => lanes[lane.key].length > 0 ? (<section key={lane.key} aria-label={lane.title} className="mt-4 first:mt-1">
            <StageHeading look={lane.look} title={lane.title} count={lanes[lane.key].length} hint={lane.hint}/>
            <ul>
              {lanes[lane.key].map((t) => <Row key={t.id} look={lane.look} task={t} today={today} open={open === t.id} onToggle={() => onToggle(t.id)} photos={photoCount(t.id)} workbench={workbench}/>)}
            </ul>
          </section>) : null)}
        {lanes.accepted.length > 0 ? (<div className="mt-2 border-t border-line px-5 pt-1 sm:px-6">
            <button type="button" aria-expanded={showAccepted} onClick={() => setShowAccepted((v) => !v)} className={cn("flex min-h-11 w-full items-center gap-2 rounded-lg text-xs font-medium text-ink-tertiary hover:text-ink", focusRing)}>
              <StageGlyph look={STAGE_LOOK.done}/>
              <span className="text-ink-secondary">{TASK_STAGE_TERMS.done.label}</span>
              <span className="tabular">{lanes.accepted.length}</span>
              <ChevronDown className={cn("ml-auto size-4 transition-transform duration-300 ease-spring", showAccepted && "rotate-180")} aria-hidden/>
            </button>
            {showAccepted ? (<ul className="pb-2">
                {lanes.accepted.map((t) => <li key={t.id} className="truncate py-1.5 text-sm text-ink-secondary">{t.title}</li>)}
              </ul>) : null}
          </div>) : null}
      </div>
    </OverviewCard>);
}

function Row({ look, task, today, open, onToggle, photos, workbench }: {
    look: StageLook;
    task: TaskWithRelations;
    today: string;
    open: boolean;
    onToggle: () => void;
    photos: number;
    workbench: (task: TaskWithRelations) => React.ReactNode;
}) {
    const reduce = useReducedMotion();
    const list = checklistProgress(task.checklist);
    const late = task.due_date ? daysBetween(task.due_date, today) : 0;
    const region = `workbench-${task.id}`;
    return (<li id={`task-${task.id}`} className={cn("scroll-mt-[calc(var(--frame-h,0px)+1rem)] border-t border-line first:border-t-0 transition-colors duration-300", open && "bg-surface-subtle")}>
      <button type="button" aria-expanded={open} aria-controls={region} onClick={onToggle} className={cn("group flex min-h-14 w-full items-center gap-3 px-5 py-2.5 text-left transition-colors duration-300 ease-spring hover:bg-surface-subtle sm:px-6", focusRing, "focus-visible:ring-inset focus-visible:ring-offset-0")}>
        <StageGlyph look={look} className="self-start mt-0.5"/>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-sm font-medium text-ink">{task.title}</span>
          <span className="flex flex-wrap items-center gap-x-2 text-xs text-ink-tertiary">
            <span className="truncate">{task.milestone?.title ?? "No milestone"}</span>
            {task.due_date ? <span className={cn("tabular", late > 0 ? "font-medium text-danger" : late === 0 ? "font-medium text-brand" : "")}>{late > 0 ? `${plural(late, "day")} late` : `due ${duePhrase(task.due_date, today)}`}</span> : null}
            {list.total > 0 ? <span className="tabular" aria-label={`${list.done} of ${list.total} checklist items done`}>{list.done}/{list.total}</span> : null}
            {photos > 0 ? <span className="inline-flex items-center gap-1 tabular" aria-label={plural(photos, "photo")}><Camera className="size-3" aria-hidden/>{photos}</span> : null}
          </span>
        </span>
        <ChevronDown className={cn("size-4 shrink-0 text-ink-tertiary transition-transform duration-300 ease-spring", open && "rotate-180")} aria-hidden/>
      </button>
      <AnimatePresence initial={false}>
        {open ? (<motion.div id={region} key="bench" initial={reduce ? { opacity: 0 } : { height: 0, opacity: 0 }} animate={reduce ? { opacity: 1 } : { height: "auto", opacity: 1 }} exit={reduce ? { opacity: 0 } : { height: 0, opacity: 0, transition: { duration: 0.2 } }} transition={SPRING} className="overflow-hidden">
            {task.description ? <p className="px-5 pb-3 text-sm leading-relaxed text-ink-secondary sm:px-7">{task.description}</p> : null}
            {workbench(task)}
          </motion.div>) : null}
      </AnimatePresence>
    </li>);
}
