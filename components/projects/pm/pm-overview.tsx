import { projectLoads } from "@/lib/dashboard";
import type { PmProjectData } from "@/lib/data/pm-project";
import { journeyStations, projectNeeds, projectStage } from "@/lib/pm-project";
import { ClosedRecord } from "./closed-record";
import { CloseoutCard } from "./closeout-card";
import { JourneyLine } from "./journey-line";
import { LatestPhotos } from "./latest-photos";
import { ProjectNeedsYou } from "./project-needs-you";
import { SetupChecklist } from "./setup-checklist";
import { WorkBar } from "./work-bar";

/**
 * The PM's project Overview. What it shows depends on where the project is:
 * setting up, running, ready to close, or closed.
 */
export function PmOverview({ data, viewerId }: {
    data: PmProjectData;
    viewerId: string;
}) {
    const { project, milestones, tasks, team, today } = data;
    const stage = projectStage(project.status, milestones, tasks);
    const load = projectLoads([project.id], tasks, milestones, today).get(project.id)!;
    const stations = journeyStations(milestones, tasks, today);

    if (stage === "closed")
        return (<div className="grid gap-5">
        <ClosedRecord projectId={project.id} title={project.title} start={project.start_date} end={project.end_date} completedAt={project.completed_at} statement={project.completion_statement} milestones={milestones.length} tasks={tasks.length} people={team.length}/>
        <JourneyLine projectId={project.id} stations={stations} today={today}/>
      </div>);

    if (stage === "setup")
        return (<div className="grid gap-5">
        <SetupChecklist projectId={project.id} title={project.title} start={project.start_date} end={project.end_date} status={project.status} invitations={data.invitations} milestoneCount={milestones.length} taskCount={tasks.length}/>
        <JourneyLine projectId={project.id} stations={stations} today={today}/>
      </div>);

    return (<div className="grid gap-5">
      {data.loadFailed ? <p role="alert" className="rounded-2xl bg-danger-soft px-4 py-3 text-sm text-danger">Some task data could not be loaded, so the figures may be incomplete. Reload to try again.</p> : null}
      {stage === "ready" ? <CloseoutCard projectId={project.id} title={project.title} statement={project.completion_statement} milestones={milestones.length} tasks={tasks.length} pmId={viewerId}/> : null}
      <JourneyLine projectId={project.id} stations={stations} today={today}/>
      <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.35fr)_minmax(0,1fr)]">
        <ProjectNeedsYou projectId={project.id} needs={projectNeeds(milestones, tasks, today)} team={team} today={today}/>
        <div className="grid gap-5">
          <WorkBar projectId={project.id} stages={load.stages} total={load.tasksTotal}/>
          <LatestPhotos projectId={project.id} photos={data.photos} today={today}/>
        </div>
      </div>
    </div>);
}
