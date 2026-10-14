"use client";
import * as React from "react";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { ProjectFrame } from "@/components/projects/shared/project-frame";
import { calendarPhrase } from "@/lib/pm-project";
import { projectHealth, projectLoads } from "@/lib/dashboard";
import type { PmProjectData } from "@/lib/data/pm-project";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { PmProjectHeader } from "./pm-project-header";
import { PmTabs } from "./pm-tabs";

/**
 * The project manager's frame around every project tab: the shared project
 * frame with the PM's header (task progress, health, team, Message) and tabs
 * (Review carries its waiting count).
 */
export function PmProjectShell({ data, children }: {
    data: PmProjectData;
    children: React.ReactNode;
}) {
    const { project, tasks, milestones, today } = data;
    const tabs = projectWorkspaceTabs(project.id, "project_manager");
    const load = projectLoads([project.id], tasks, milestones, today).get(project.id)!;
    const health = projectHealth(project, load, today, load.overdue);
    return (<ProjectFrame channel={`pm-project-${project.id}`} tabs={tabs} renderTabs={(active) => <PmTabs tabs={tabs} active={active} reviewCount={load.inReview.length}/>} header={(compact) => <PmProjectHeader projectId={project.id} title={project.title} client={project.client?.full_name ?? "No client yet"} accepted={load.stages.done} total={load.tasksTotal} tasksFailed={data.loadFailed} health={health} calendar={calendarPhrase(project.start_date, project.end_date, today)} team={data.team} unread={data.unread} compact={compact}/>} banner={<ProjectClosedBanner project={project} variant="pm"/>}>
      {children}
    </ProjectFrame>);
}
