"use client";
import * as React from "react";
import { HEALTH_TONE } from "@/components/dashboard/overview-kit";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { PmTabs } from "@/components/projects/pm/pm-tabs";
import { ProjectFrame } from "@/components/projects/shared/project-frame";
import { RoleProjectHeader } from "@/components/projects/shared/role-project-header";
import { ROUTES } from "@/lib/constants";
import { crewHealth, myShare } from "@/lib/crew-project";
import type { CrewProjectData } from "@/lib/data/crew-project";
import { calendarPhrase } from "@/lib/pm-project";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { cn } from "@/lib/utils";

/**
 * A middleman's frame around every project tab: their own progress here (not
 * the whole project's), the project's health for them, the team and Message.
 */
export function CrewProjectShell({ data, viewerId, children }: {
    data: CrewProjectData;
    viewerId: string;
    children: React.ReactNode;
}) {
    const { project, tasks, today } = data;
    const tabs = projectWorkspaceTabs(project.id, "middleman");
    const share = myShare(tasks, viewerId);
    const health = crewHealth(project.status, tasks, viewerId, today);
    const value = share.total > 0 ? share.accepted / share.total : 0;
    const status = (<>
      {project.pm?.full_name ?? "No project manager yet"}
      {" · "}
      {data.loadFailed ? "Tasks unavailable" : share.total > 0 ? <><b className="font-medium text-ink">{share.accepted} of {share.total}</b> of yours accepted</> : "Nothing assigned to you yet"}
      {" · "}
      <span className={cn("font-medium", HEALTH_TONE[health.tone].tone)}>{health.text}</span>
      {" · "}
      {calendarPhrase(project.start_date, project.end_date, today)}
    </>);
    return (<ProjectFrame live={{ channel: "crew-project", projectId: project.id, announce: "crew", viewerId }} tabs={tabs} renderTabs={(active) => <PmTabs tabs={tabs} active={active} reviewCount={0}/>} header={(compact) => <RoleProjectHeader projectId={project.id} title={project.title} share={value} done={value >= 1 && health.tone !== "late"} status={status} team={data.team} unread={data.unread} compact={compact} home={ROUTES.MIDDLEMAN_HOME} messageLabel="Message"/>} banner={<ProjectClosedBanner project={project} variant="middleman"/>}>
      {children}
    </ProjectFrame>);
}
