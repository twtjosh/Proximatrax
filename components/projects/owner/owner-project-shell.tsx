"use client";
import * as React from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, FileText, History, MoreHorizontal } from "lucide-react";
import { focusRing, HEALTH_TONE, ProgressRing } from "@/components/dashboard/overview-kit";
import { ReportDialog } from "@/components/projects/pm/report/report-dialog";
import { PmTabs } from "@/components/projects/pm/pm-tabs";
import { HEALTH_STYLE } from "@/components/projects/pm/status-update-dialog";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { ProjectFrame } from "@/components/projects/shared/project-frame";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuGroup, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { analyticsManagerPath } from "@/lib/constants";
import { agoPhrase, isoDateIn, projectHealth, projectLoads } from "@/lib/dashboard";
import type { PmProjectData } from "@/lib/data/pm-project";
import { calendarPhrase } from "@/lib/pm-project";
import { HEALTH } from "@/lib/project-log";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { cn } from "@/lib/utils";
import { ActivityLogDialog } from "./activity-log-dialog";

type Panel = "report" | "activity";

/**
 * The super admin's frame around a project: the PM's five tabs to look
 * through, read only, under a header that says where the project stands and
 * whose it is. The menu opens the Project report and the Activity log over
 * any tab (kept in the URL as ?panel=, so links and Back work). No Message:
 * in-app chat is between the project's people.
 */
export function OwnerProjectShell({ data, children }: {
    data: PmProjectData;
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
    const pm = data.team.find((m) => m.id === project.pm_id)?.name ?? "No project manager";

    const setPanel = React.useCallback((next: Panel | null) => {
        const q = new URLSearchParams(params.toString());
        if (next)
            q.set("panel", next);
        else
            q.delete("panel");
        const qs = q.toString();
        router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
    }, [params, pathname, router]);

    return (<>
      <ProjectFrame live={{ channel: "owner-project", projectId: project.id }} tabs={tabs} renderTabs={(active) => <PmTabs tabs={tabs} active={active} reviewCount={0}/>} banner={<ProjectClosedBanner project={project} variant="pm"/>} header={(compact) => {
            const share = load.tasksTotal > 0 ? load.stages.done / load.tasksTotal : 0;
            const tone = HEALTH_TONE[health.tone];
            return (<div className="flex items-center gap-3 sm:gap-4">
              <ProgressRing value={share} done={share >= 1 && health.tone !== "late"} size={54} stroke={5.5} className={cn("origin-left transition-[scale,translate] duration-500 ease-spring motion-reduce:transition-none", compact && "translate-y-2 scale-[0.67]")}>
                <span className={cn("block text-[13px] font-semibold text-ink tabular transition-transform duration-500 ease-spring motion-reduce:transition-none", compact && "scale-[1.15]")}>{Math.round(share * 100)}</span>
              </ProgressRing>
              <div className="min-w-0 flex-1">
                <button type="button" onClick={() => router.push(analyticsManagerPath(project.pm_id))} tabIndex={compact ? -1 : undefined} aria-hidden={compact || undefined} className={cn("-my-1 mb-[-0.125rem] inline-flex items-center gap-1 rounded-sm py-1 text-xs font-medium text-ink-tertiary transition-opacity duration-300 hover:text-ink motion-reduce:transition-none", compact && "pointer-events-none opacity-0", focusRing)}>
                  <ArrowLeft className="size-3.5" aria-hidden/>
                  {pm}’s projects
                </button>
                <h1 className={cn("origin-left truncate text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.034em] text-ink transition-transform duration-500 ease-spring motion-reduce:transition-none", compact && "translate-y-2 scale-[0.68]")}>{project.title}</h1>
                <p className={cn("truncate text-[13px] text-ink-tertiary transition-opacity duration-300 motion-reduce:transition-none", compact && "opacity-0")}>
                  {project.client?.full_name ?? "No client yet"}
                  {" · "}
                  {data.loadFailed ? "Tasks unavailable" : load.tasksTotal > 0 ? <><b className="font-medium text-ink">{load.stages.done} of {load.tasksTotal}</b> tasks accepted</> : "No tasks yet"}
                  {" · "}
                  <span className={cn("font-medium", tone.tone)}>{health.text}</span>
                  <span className="max-sm:hidden">{" · "}{calendarPhrase(project.start_date, project.end_date, today)}</span>
                  {data.update && project.status !== "completed" ? (<>
                      {" · "}
                      <span title={data.update.note} className={cn("inline-flex items-center gap-1.5 rounded-full px-2 py-px align-[1px] text-xs font-semibold", HEALTH_STYLE[data.update.health].chip)}>
                        <span className={cn("size-1.5 rounded-full", HEALTH_STYLE[data.update.health].dot)} aria-hidden/>
                        {HEALTH[data.update.health].label}
                        <span className="font-normal">{agoPhrase(isoDateIn(data.update.at), today)}</span>
                      </span>
                    </>) : null}
                </p>
              </div>
              <span className="shrink-0 rounded-full bg-surface-sunken px-2.5 py-1 text-xs font-medium text-ink-secondary max-sm:hidden">View only</span>
              <DropdownMenu>
                <DropdownMenuTrigger aria-label="Project menu" className={cn("press grid size-9 shrink-0 cursor-pointer place-items-center rounded-full bg-surface-sunken text-ink hover:bg-line", focusRing)}>
                  <MoreHorizontal className="size-4" aria-hidden/>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end" className="min-w-60">
                  <DropdownMenuGroup>
                    <DropdownMenuLabel>Reports</DropdownMenuLabel>
                    <DropdownMenuItem onClick={() => setPanel("report")}><FileText aria-hidden/>Project report</DropdownMenuItem>
                    <DropdownMenuItem onClick={() => setPanel("activity")}><History aria-hidden/>Activity log</DropdownMenuItem>
                  </DropdownMenuGroup>
                </DropdownMenuContent>
              </DropdownMenu>
            </div>);
        }}>
        {children}
      </ProjectFrame>
      <ReportDialog open={panel === "report"} onOpenChange={(o) => setPanel(o ? "report" : null)} data={data}/>
      <ActivityLogDialog open={panel === "activity"} onOpenChange={(o) => setPanel(o ? "activity" : null)} data={data}/>
    </>);
}
