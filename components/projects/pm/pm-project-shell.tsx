"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { ProjectClosedBanner } from "@/components/projects/project-closed-banner";
import { calendarPhrase } from "@/lib/pm-project";
import { projectHealth, projectLoads } from "@/lib/dashboard";
import type { PmProjectData } from "@/lib/data/pm-project";
import { SPRING } from "@/lib/motion";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { cn } from "@/lib/utils";
import { PmProjectHeader } from "./pm-project-header";
import { activeTabIndex, PmTabs } from "./pm-tabs";

/** How far a tab's content travels as it arrives, toward the side you moved. */
const TRAVEL = 28;

/**
 * The project manager's frame around every project tab: a sticky header that
 * condenses on scroll, the tabs, and content that slides in from the side of
 * travel. Live changes from the site re-render the page.
 */
export function PmProjectShell({ data, children }: {
    data: PmProjectData;
    children: React.ReactNode;
}) {
    const { project, tasks, milestones, today } = data;
    const pathname = usePathname();
    const reduce = useReducedMotion();
    const tabs = projectWorkspaceTabs(project.id, "project_manager");
    const active = Math.max(activeTabIndex(pathname, tabs), 0);
    // The side content arrives from: remembered from the last tab, the way React stores previous-render facts.
    const [previous, setPrevious] = React.useState(active);
    const [direction, setDirection] = React.useState(0);
    if (previous !== active) {
        setDirection(active > previous ? 1 : -1);
        setPrevious(active);
    }

    const load = projectLoads([project.id], tasks, milestones, today).get(project.id)!;
    const health = projectHealth(project, load, today, load.overdue);

    // A sentinel above the header tells us when the page has scrolled under it.
    const sentinel = React.useRef<HTMLDivElement>(null);
    const [compact, setCompact] = React.useState(false);
    React.useEffect(() => {
        const el = sentinel.current;
        if (!el)
            return;
        const io = new IntersectionObserver(([entry]) => setCompact(!entry.isIntersecting), { root: document.getElementById("workspace-main") });
        io.observe(el);
        return () => io.disconnect();
    }, []);

    return (<div className="mx-auto w-full max-w-360">
      <LiveRefresh channel={`pm-project-${project.id}`}/>
      <div ref={sentinel} aria-hidden className="h-px"/>
      <header className={cn("sticky top-0 z-20 -mx-4 border-b border-line bg-canvas/85 px-4 backdrop-blur-xl transition-[padding] duration-500 ease-spring sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8", compact ? "pt-3" : "pt-1")}>
        <PmProjectHeader projectId={project.id} title={project.title} client={project.client?.full_name ?? "No client yet"} accepted={load.stages.done} total={load.tasksTotal} health={health} calendar={calendarPhrase(project.start_date, project.end_date, today)} team={data.team} unread={data.unread} compact={compact}/>
        <div className="mt-3">
          <PmTabs tabs={tabs} active={active} reviewCount={load.inReview.length}/>
        </div>
      </header>
      {active !== 0 ? <div className="mt-5"><ProjectClosedBanner project={project} variant="pm"/></div> : null}
      <motion.div key={active} initial={reduce || direction === 0 ? false : { opacity: 0, x: direction * TRAVEL }} animate={{ opacity: 1, x: 0 }} transition={SPRING} className="pt-6 pb-12">
        {children}
      </motion.div>
    </div>);
}
