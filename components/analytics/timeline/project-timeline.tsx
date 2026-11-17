"use client";
import * as React from "react";
import { motion } from "framer-motion";
import { AlertTriangle, CheckCircle2, Circle, CircleDot } from "lucide-react";
import { Meter } from "@/components/analytics/meter";
import { OverviewCard, stagger } from "@/components/dashboard/overview-kit";
import { milestoneSteps, stepPhrase, timelineSentence, type Step, type StepState } from "@/lib/analytics-insights";
import { daysBetween, formatDate, isoDateIn, plural } from "@/lib/dashboard";
import { milestoneColor } from "@/lib/milestone-colors";
import type { TimelineData, TimelineProject } from "@/lib/project-timeline";
import { cn } from "@/lib/utils";
import { ProjectPicker, type ProjectOption } from "./project-picker";

const short = (iso: string) => formatDate(iso, { month: "short", day: "numeric" });
const long = (iso: string) => formatDate(iso, { month: "short", day: "numeric", year: "numeric" });

/** Where a project stands against its due date, in the words the Projects list uses. */
function standing(p: TimelineProject, today: string): ProjectOption["status"] {
    if (p.completedAt) {
        const late = daysBetween(p.end, isoDateIn(p.completedAt));
        return late > 0 ? { text: `Delivered ${plural(late, "day")} late`, tone: "late" } : { text: "Delivered on time", tone: "done" };
    }
    const over = daysBetween(p.end, today);
    return over > 0 ? { text: `${plural(over, "day")} past end date`, tone: "late" } : { text: `${plural(-over, "day")} left`, tone: "ok" };
}

const STATE: Record<StepState, { icon: typeof Circle; tone: string; word: string }> = {
    on_time: { icon: CheckCircle2, tone: "text-success", word: "On time" },
    late: { icon: CheckCircle2, tone: "text-warning", word: "Late" },
    missed: { icon: AlertTriangle, tone: "text-danger", word: "Missed" },
    due: { icon: Circle, tone: "text-ink-tertiary", word: "Due" },
};

type TimelineTaskRow = { id: string; project_id: string; milestone_id: string | null; stage: string };

/**
 * One project's milestones in date order, with today marked where it falls
 * and a sentence saying where the project is and what comes next. Each
 * milestone says plainly how it stands and how many of its tasks are
 * accepted. Activity lives in its own card below.
 */
export function ProjectTimeline({ data, tasks, today }: {
    data: TimelineData;
    tasks: TimelineTaskRow[];
    today: string;
}) {
    // Active projects first, newest start first; then delivered, most recent first.
    const ordered = React.useMemo(() => [...data.projects].sort((a, b) => Number(b.active) - Number(a.active)
        || (a.active ? b.start.localeCompare(a.start) : (b.completedAt ?? b.end).localeCompare(a.completedAt ?? a.end))), [data.projects]);
    const [projectId, setProjectId] = React.useState(ordered[0]?.id ?? "");
    const project = ordered.find((p) => p.id === projectId) ?? ordered[0];
    const options = React.useMemo<ProjectOption[]>(() => ordered.map((p) => {
        const own = tasks.filter((t) => t.project_id === p.id);
        return { id: p.id, title: p.title, client: p.client, dates: `${short(p.start)} – ${long(p.end)}`, accepted: own.filter((t) => t.stage === "done").length, total: own.length, status: standing(p, today) };
    }), [ordered, tasks, today]);
    const steps = React.useMemo(() => project
        ? milestoneSteps(data.milestones.filter((m) => m.project_id === project.id).map((m) => ({ id: m.id ?? `${m.title}:${m.due_date}`, title: m.title, due_date: m.due_date, completed_at: m.completed_at })), tasks.filter((t) => t.project_id === project.id), today)
        : [], [data.milestones, project, tasks, today]);

    if (!project) {
        return (<OverviewCard id="timeline-heading" title="Project timeline" className="materialize mt-4" style={stagger(4)}>
          <p className="px-5 pt-1 pb-6 text-sm text-ink-tertiary sm:px-6">No projects yet. Each project’s milestones show here once it has some.</p>
        </OverviewCard>);
    }

    // Today sits after every milestone due before it, so the list reads past, today, ahead.
    const todayAt = project.completedAt ? -1 : steps.filter((s) => s.due < today).length;
    const nextId = steps.find((s) => s.state === "due")?.id;

    return (<OverviewCard id="timeline-heading" title="Project timeline" sub="One project’s milestones in date order, with today marked." className="materialize mt-4" style={stagger(4)}>
      <div className="grid gap-5 px-5 pt-2 pb-5 sm:px-6">
        <div className="flex min-w-0 flex-wrap items-center gap-x-6 gap-y-3">
          <ProjectPicker projects={options} value={project.id} onChange={setProjectId}/>
          <p className="max-w-xl min-w-60 flex-1 text-[14px] leading-relaxed text-pretty text-ink-secondary">{timelineSentence(project, steps, today)}</p>
        </div>

        {steps.length === 0 ? <p className="rounded-2xl bg-surface-subtle px-4 py-3 text-[13px] text-ink-tertiary">No milestones set for this project yet.</p> : (
          <motion.ol key={project.id} initial={{ opacity: 0, y: 6 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.2 }} className="relative grid min-w-0" aria-label={`Milestones of ${project.title}`}>
            {steps.map((s, i) => (<React.Fragment key={s.id}>
                {i === todayAt ? <TodayRow today={today}/> : null}
                <StepRow step={s} index={i} next={s.id === nextId} last={i === steps.length - 1 && todayAt !== steps.length}/>
              </React.Fragment>))}
            {todayAt === steps.length ? <TodayRow today={today} last/> : null}
          </motion.ol>)}
      </div>
    </OverviewCard>);
}

/**
 * One milestone: a state icon on the line, then a band in the milestone's own
 * colour (the same one the Timeline tab gives it) with its number, name, how
 * it stands and its tasks accepted.
 */
function StepRow({ step: s, index, next, last }: { step: Step; index: number; next: boolean; last: boolean }) {
    const st = STATE[s.state], Icon = next ? CircleDot : st.icon, color = milestoneColor(index);
    return (<li className="relative grid grid-cols-[1.75rem_minmax(0,1fr)] gap-x-3 pb-2.5 last:pb-0">
      {!last ? <span className="absolute top-9 bottom-0 left-[0.8125rem] w-px bg-line-strong" aria-hidden/> : null}
      <span className={cn("relative mt-2.5 grid size-7 place-items-center rounded-full bg-surface", next ? "text-copper" : st.tone)} aria-hidden><Icon className="size-[18px]" strokeWidth={2.2}/></span>
      <div className="grid min-w-0 items-center gap-x-4 gap-y-2 rounded-2xl px-3.5 py-3 sm:grid-cols-[minmax(0,1fr)_15rem]" style={{ background: `color-mix(in srgb, ${color} 7%, var(--surface))`, boxShadow: `inset 0 0 0 1px color-mix(in srgb, ${color} 22%, transparent)` }}>
      <div className="min-w-0">
        <p className="flex flex-wrap items-center gap-x-2 gap-y-1">
          <span className="grid h-5 min-w-5 place-items-center rounded-md px-1 text-[11px] font-bold text-white tabular" style={{ background: color }} aria-hidden>{index + 1}</span>
          <span className={cn("font-semibold break-words", s.state === "missed" ? "text-danger" : "text-ink")}><span className="sr-only">Milestone {index + 1}: </span>{s.title}</span>
          {next ? <span className="rounded-full bg-brand-soft px-2 text-[11px] leading-5 font-semibold text-brand">Next</span> : null}
        </p>
        <p className={cn("text-[13px]", s.state === "missed" ? "font-medium text-danger" : s.state === "late" ? "text-warning" : "text-ink-tertiary")}>
          <span className="sr-only">{st.word}. </span>{stepPhrase(s)}
        </p>
      </div>
      <div>
        {s.tasks.of ? <Meter value={s.tasks} unit="tasks" color={color}/> : <span className="text-[12.5px] text-ink-tertiary">No tasks in this milestone</span>}
      </div>
      </div>
    </li>);
}

/** Where today falls between the milestones. */
function TodayRow({ today, last }: { today: string; last?: boolean }) {
    return (<li className={cn("relative grid grid-cols-[1.75rem_minmax(0,1fr)] items-center gap-x-3", last ? "" : "pb-4")}>
      {!last ? <span className="absolute top-7 bottom-0 left-[0.8125rem] w-px bg-line-strong" aria-hidden/> : null}
      <span className="relative grid size-7 place-items-center" aria-hidden><span className="size-3 rounded-full bg-copper ring-4 ring-brand-soft"/></span>
      <span className="flex items-center gap-3 text-[12.5px] font-semibold text-brand">Today, {formatDate(today, { weekday: "short", month: "short", day: "numeric" })}<span className="h-px flex-1 bg-copper/40" aria-hidden/></span>
    </li>);
}
