"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import { LiveRefresh } from "@/components/dashboard/live-refresh";
import { activeTabIndex } from "@/components/projects/pm/pm-tabs";
import { SPRING } from "@/lib/motion";
import type { ProjectWorkspaceTab } from "@/lib/project-view-policy";

/** How far a tab's content travels as it arrives, toward the side you moved. */
const TRAVEL = 28;

/**
 * The frame around every project tab, for every role: a sticky header that
 * condenses on scroll, the tabs, and content that slides in from the side of
 * travel. Live changes re-render the page.
 *
 * The scroll area (#workspace-main) has top padding, and a sticky element
 * stops at that padding rather than the edge, which would leave a strip of
 * page scrolling past above the header. So the header sticks at minus the
 * measured padding (`--frame-pad`). `--frame-h` is the header's height (for
 * scroll margins); `--frame-stick` is the `top` that puts other sticky
 * content right under it.
 */
export function ProjectFrame({ live, tabs, header, renderTabs, banner, children }: {
    /** What this role's live view listens to and announces. */
    live: React.ComponentProps<typeof LiveRefresh>;
    tabs: ProjectWorkspaceTab[];
    header: (compact: boolean) => React.ReactNode;
    renderTabs: (active: number) => React.ReactNode;
    /** Shown above every tab but Overview, which tells its own story. */
    banner?: React.ReactNode;
    children: React.ReactNode;
}) {
    const pathname = usePathname();
    const reduce = useReducedMotion();
    const active = Math.max(activeTabIndex(pathname, tabs), 0);
    // The side content arrives from: remembered from the last tab, the way React stores previous-render facts.
    const [previous, setPrevious] = React.useState(active);
    const [direction, setDirection] = React.useState(0);
    if (previous !== active) {
        setDirection(active > previous ? 1 : -1);
        setPrevious(active);
    }

    // A 24px sentinel above the header: once it has scrolled out, the header condenses.
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

    const root = React.useRef<HTMLDivElement>(null);
    const head = React.useRef<HTMLElement>(null);
    React.useEffect(() => {
        const frame = root.current;
        const el = head.current;
        if (!frame || !el)
            return;
        const scroller = document.getElementById("workspace-main");
        const measure = () => {
            const pad = scroller ? parseFloat(getComputedStyle(scroller).paddingTop) || 0 : 0;
            frame.style.setProperty("--frame-pad", `${pad}px`);
            frame.style.setProperty("--frame-h", `${el.offsetHeight}px`);
            frame.style.setProperty("--frame-stick", `${el.offsetHeight - pad}px`);
        };
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        if (scroller)
            ro.observe(scroller);
        return () => ro.disconnect();
    }, []);

    return (<div ref={root} className="mx-auto w-full max-w-360">
      <LiveRefresh {...live}/>
      <div ref={sentinel} aria-hidden className="-mb-6 h-6"/>
      <header ref={head} className="sticky top-[calc(var(--frame-pad,0px)*-1)] z-20 -mx-4 border-b border-line bg-canvas/85 px-4 pt-1 backdrop-blur-xl sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
        {header(compact)}
        <div className="mt-3">{renderTabs(active)}</div>
      </header>
      {active !== 0 && banner ? <div className="mt-5">{banner}</div> : null}
      <motion.div key={active} initial={reduce || direction === 0 ? false : { opacity: 0, x: direction * TRAVEL }} animate={{ opacity: 1, x: 0 }} transition={SPRING} className="pt-6 pb-12">
        {children}
      </motion.div>
    </div>);
}
