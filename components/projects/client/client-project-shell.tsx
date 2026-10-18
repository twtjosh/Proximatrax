"use client";
import * as React from "react";
import { HEALTH_TONE } from "@/components/dashboard/overview-kit";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { PmTabs } from "@/components/projects/pm/pm-tabs";
import { ProjectFrame } from "@/components/projects/shared/project-frame";
import { RoleProjectHeader } from "@/components/projects/shared/role-project-header";
import { clientHealth } from "@/lib/client-project";
import { ROUTES } from "@/lib/constants";
import type { ClientProjectData } from "@/lib/data/client-project";
import { calendarPhrase } from "@/lib/pm-project";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { cn } from "@/lib/utils";

/** A client's frame around every project tab: progress in milestones (never tasks), health in plain words, and their PM a tap away. */
export function ClientProjectShell({ data, children }: {
    data: ClientProjectData;
    children: React.ReactNode;
}) {
    const { project, milestones, today } = data;
    const tabs = projectWorkspaceTabs(project.id, "client");
    const delivered = milestones.filter((m) => m.completed).length;
    const value = milestones.length > 0 ? delivered / milestones.length : 0;
    const health = clientHealth(project.status, milestones, today);
    const status = (<>
      {project.pm?.full_name ?? "Your project manager"}
      {" · "}
      {milestones.length > 0 ? <><b className="font-medium text-ink">{delivered} of {milestones.length}</b> milestones delivered</> : "Milestones coming soon"}
      {" · "}
      <span className={cn("font-medium", HEALTH_TONE[health.tone].tone)}>{health.text}</span>
      {" · "}
      {calendarPhrase(project.start_date, project.end_date, today)}
    </>);
    return (<ProjectFrame live={{ channel: "client-project", projectId: project.id }} tabs={tabs} renderTabs={(active) => <PmTabs tabs={tabs} active={active} reviewCount={0}/>} header={(compact) => <RoleProjectHeader projectId={project.id} title={project.title} share={value} done={value >= 1} status={status} team={data.team} unread={data.unread} compact={compact} home={ROUTES.DASHBOARD} messageLabel="Message your PM"/>} banner={<ProjectClosedBanner project={project} variant="client"/>}>
      {children}
    </ProjectFrame>);
}
