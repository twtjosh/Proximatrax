"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { ProjectFrame } from "@/components/projects/shared/project-frame";
import { calendarPhrase } from "@/lib/pm-project";
import { projectBoardPath, projectReviewPath } from "@/lib/constants";
import { projectHealth, projectLoads } from "@/lib/dashboard";
import type { PmProjectData } from "@/lib/data/pm-project";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { PeoplePanel } from "./people-panel";
import { PmProjectHeader } from "./pm-project-header";
import { PmTabs } from "./pm-tabs";
import { ProjectShortcuts } from "./project-shortcuts";
import { SettingsPanel } from "./settings-panel";

/**
 * The project manager's frame around every project tab: the shared project
 * frame with the PM's header and three tabs, plus what opens over any tab:
 * People and Settings as side panels (kept in the URL as ?panel=, so links and
 * Back work) and keyboard shortcuts.
 */
export function PmProjectShell({ data, viewerId, children }: {
    data: PmProjectData;
    viewerId: string;
    children: React.ReactNode;
}) {
    const { project, tasks, milestones, today } = data;
    const router = useRouter();
    const pathname = usePathname();
    const params = useSearchParams();
    const tabs = projectWorkspaceTabs(project.id, "project_manager");
    const load = projectLoads([project.id], tasks, milestones, today).get(project.id)!;
    const health = projectHealth(project, load, today, load.overdue);
    const panel = params.get("panel");

    const setPanel = React.useCallback((next: "people" | "settings" | null, section?: string) => {
        const q = new URLSearchParams(params.toString());
        if (next)
            q.set("panel", next);
        else
            q.delete("panel");
        if (section)
            q.set("section", section);
        else
            q.delete("section");
        const qs = q.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);
    const openPeople = React.useCallback(() => setPanel("people"), [setPanel]);
    const openSettings = React.useCallback(() => setPanel("settings"), [setPanel]);

    return (<>
      <ProjectFrame channel={`pm-project-${project.id}`} tabs={tabs} renderTabs={(active) => <PmTabs tabs={tabs} active={active} reviewCount={0}/>} header={(compact) => <PmProjectHeader projectId={project.id} title={project.title} client={project.client?.full_name ?? "No client yet"} accepted={load.stages.done} total={load.tasksTotal} tasksFailed={data.loadFailed} health={health} calendar={calendarPhrase(project.start_date, project.end_date, today)} team={data.team} unread={data.unread} compact={compact} reviewCount={load.inReview.length} reviewHref={projectReviewPath(project.id)} closed={project.status === "completed"} onPeople={openPeople} onSettings={(section) => setPanel("settings", section)}/>} banner={<ProjectClosedBanner project={project} variant="pm"/>}>
        {children}
      </ProjectFrame>
      <PeoplePanel open={panel === "people"} onOpenChange={(o) => setPanel(o ? "people" : null)} projectId={project.id} team={data.team} tasks={tasks} today={today}/>
      <SettingsPanel open={panel === "settings"} onOpenChange={(o) => setPanel(o ? "settings" : null)} section={params.get("section")} project={project} milestones={milestones} tasks={tasks} viewerId={viewerId}/>
      <ProjectShortcuts tabs={tabs} reviewHref={projectReviewPath(project.id)} boardHref={projectBoardPath(project.id)} onPeople={openPeople} onSettings={openSettings}/>
    </>);
}
