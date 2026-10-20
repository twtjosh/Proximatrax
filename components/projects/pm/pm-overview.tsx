import { projectLoads } from "@/lib/dashboard";
import { forecastHandover, progressSeries } from "@/lib/project-insights";
import type { PmProjectData } from "@/lib/data/pm-project";
import { journeyStations, projectNeeds, projectStage } from "@/lib/pm-project";
import type { Profile } from "@/types/database";
import { ClosedRecord } from "./closed-record";
import { CloseoutCard } from "./closeout-card";
import { JourneyLine } from "./journey-line";
import { ProjectNeedsYou } from "./project-needs-you";
import { SetupChecklist } from "./setup-checklist";
import { ProgressChart } from "./overview/progress-chart";
import { NoOwner } from "./overview/no-owner";
import { OnSiteNow } from "./overview/site-and-log";
import { StatusStrip } from "./overview/status-strip";

/**
 * The PM's project Overview, the command centre. What it shows depends on
 * where the project is: setting up, running, ready to close, or closed. While
 * running: the PM's status and four numbers, the milestone line, what needs
 * them (and work no one has yet) beside progress against plan, then who is on site.
 */
export function PmOverview({ data, viewerId, people, readOnly = false }: {
    data: PmProjectData;
    viewerId: string;
    /** Who tasks can be given to: the PM and the project's crew. */
    people: Profile[];
    /** The super admin's view: where the project stands, without the PM's to-dos and actions. */
    readOnly?: boolean;
}) {
    const { project, milestones, tasks, team, today } = data;
    const stage = projectStage(project.status, milestones, tasks, data.loadFailed);
    const load = projectLoads([project.id], tasks, milestones, today).get(project.id)!;
    const stations = journeyStations(milestones, tasks, today);

    if (stage === "closed")
        return (<div className="grid gap-5">
        <ClosedRecord readOnly={readOnly} projectId={project.id} title={project.title} start={project.start_date} end={project.end_date} completedAt={project.completed_at} statement={project.completion_statement} milestones={milestones.length} tasks={tasks.length} people={team.length}/>
        <JourneyLine projectId={project.id} stations={stations} today={today}/>
      </div>);

    if (stage === "unavailable")
        return (<div className="grid gap-5">
        <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">This project&apos;s tasks could not be loaded, so its progress can&apos;t be shown right now. Reload to try again.</p>
        <JourneyLine projectId={project.id} stations={stations} today={today}/>
      </div>);

    if (readOnly) {
        const forecast = forecastHandover(project.start_date, project.end_date, tasks, today);
        return (<div className="grid gap-5">
          <StatusStrip projectId={project.id} update={data.update} accepted={load.stages.done} total={load.tasksTotal} end={project.end_date} forecast={forecast} late={load.overdue} inReview={load.stages.review} today={today} closed by={team.find((m) => m.id === data.update?.by)?.name ?? null}/>
          <JourneyLine projectId={project.id} stations={stations} today={today}/>
          <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
            <OnSiteNow projectId={project.id} tasks={tasks} team={team} today={today}/>
            <ProgressChart points={progressSeries(project.start_date, project.end_date, tasks, today)} total={load.tasksTotal}/>
          </div>
        </div>);
    }

    if (stage === "setup")
        return (<div className="grid gap-5">
        <SetupChecklist projectId={project.id} title={project.title} start={project.start_date} end={project.end_date} status={project.status} invitations={data.invitations} milestoneCount={milestones.length} taskCount={tasks.length}/>
        <JourneyLine projectId={project.id} stations={stations} today={today}/>
      </div>);

    const closedNow = project.status === "completed";
    return (<div className="grid gap-5">
      {stage === "ready" ? <CloseoutCard projectId={project.id} title={project.title} statement={project.completion_statement} milestones={milestones.length} tasks={tasks.length} pmId={viewerId}/> : null}
      <StatusStrip projectId={project.id} update={data.update} accepted={load.stages.done} total={load.tasksTotal} end={project.end_date} forecast={forecastHandover(project.start_date, project.end_date, tasks, today)} late={load.overdue} inReview={load.stages.review} today={today} closed={closedNow} by={team.find((m) => m.id === data.update?.by)?.name ?? null}/>
      <JourneyLine projectId={project.id} stations={stations} today={today}/>
      {/* Two stacked columns, not two rows: a tall card no longer leaves a hole beside a short one. */}
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="flex min-w-0 flex-col gap-5">
          <ProjectNeedsYou projectId={project.id} needs={projectNeeds(milestones, tasks, today)} team={team} today={today}/>
          <NoOwner projectId={project.id} tasks={tasks} people={people} today={today} closed={closedNow}/>
          <OnSiteNow projectId={project.id} tasks={tasks} team={team} today={today}/>
        </div>
        <ProgressChart points={progressSeries(project.start_date, project.end_date, tasks, today)} total={load.tasksTotal}/>
      </div>
    </div>);
}
