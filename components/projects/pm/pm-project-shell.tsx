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
import { PmProjectHeader } from "./pm-project-header";
import { PmTabs } from "./pm-tabs";
import { ProjectShortcuts } from "./project-shortcuts";
import { SettingsPanel } from "./settings-panel";
import { StatusUpdateDialog } from "./status-update-dialog";

/**
 * The project manager's frame around every project tab: the shared project
 * frame with the PM's header and six tabs, plus what opens over any tab:
 * Settings as a side panel (kept in the URL as ?panel=, so links and Back
 * work), the status update composer, and keyboard shortcuts.
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

    const setPanel = React.useCallback((next: "settings" | null, section?: string) => {
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
    const openSettings = React.useCallback(() => setPanel("settings"), [setPanel]);

    return (<>
      <ProjectFrame channel={`pm-project-${project.id}`} tabs={tabs} renderTabs={(active) => <PmTabs tabs={tabs} active={active} reviewCount={0}/>} header={(compact) => <PmProjectHeader projectId={project.id} title={project.title} client={project.client?.full_name ?? "No client yet"} accepted={load.stages.done} total={load.tasksTotal} tasksFailed={data.loadFailed} health={health} update={data.update} calendar={calendarPhrase(project.start_date, project.end_date, today)} team={data.team} unread={data.unread} compact={compact} reviewCount={load.inReview.length} reviewHref={projectReviewPath(project.id)} closed={project.status === "completed"} onSettings={(section) => setPanel("settings", section)}/>} banner={<ProjectClosedBanner project={project} variant="pm"/>}>
        {children}
      </ProjectFrame>
      <SettingsPanel open={panel === "settings"} onOpenChange={(o) => setPanel(o ? "settings" : null)} section={params.get("section")} project={project} milestones={milestones} tasks={tasks} viewerId={viewerId}/>
      <StatusUpdateDialog projectId={project.id} last={data.update} suggested={health.tone === "late" || health.tone === "brand" ? "at_risk" : "on_track"}/>
      <ProjectShortcuts tabs={tabs} reviewHref={projectReviewPath(project.id)} boardHref={projectBoardPath(project.id)} onSettings={openSettings}/>
    </>);
}
