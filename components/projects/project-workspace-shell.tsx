"use client";
import * as React from "react";
import { headerVisualTierFromHeight, ProjectHeaderPane, } from "@/components/projects/project-header-pane";
import { densityFromHeight, ProjectWorkspaceProvider, type ProjectWorkspaceLayout, } from "@/components/projects/project-workspace-context";
import { cn } from "@/lib/utils";
const STORAGE_PREFIX = "ptx-project-header-height:";
const MIN_HEADER_PX = 160;
const MAX_HEADER_VH = 0.55;
const DEFAULT_HEADER_PX = 300;
const HEADER_TIGHT_MAX = 228;
const HEADER_ROOMY_MIN = 360;
const CONTENT_TIGHT_MAX = 380;
const CONTENT_ROOMY_MIN = 520;
type ProjectWorkspaceShellProps = {
    projectId: string;
    isClient: boolean;
    headerBeforeTabs: React.ReactNode;
    tabs: React.ReactNode;
    children: React.ReactNode;
};
function clampHeaderHeight(px: number, viewportHeight: number) {
    const maxPx = Math.round(viewportHeight * MAX_HEADER_VH);
    return Math.min(Math.max(px, MIN_HEADER_PX), Math.max(maxPx, MIN_HEADER_PX));
}
function readStoredHeight(projectId: string): number | null {
    if (typeof window === "undefined")
        return null;
    try {
        const raw = localStorage.getItem(`${STORAGE_PREFIX}${projectId}`);
        if (!raw)
            return null;
        const n = Number.parseInt(raw, 10);
        return Number.isFinite(n) ? n : null;
    }
    catch {
        return null;
    }
}
function writeStoredHeight(projectId: string, px: number) {
    try {
        localStorage.setItem(`${STORAGE_PREFIX}${projectId}`, String(px));
    }
    catch {
    }
}
function clearStoredHeight(projectId: string) {
    try {
        localStorage.removeItem(`${STORAGE_PREFIX}${projectId}`);
    }
    catch {
    }
}
export function ProjectWorkspaceShell({ projectId, isClient, headerBeforeTabs, tabs, children, }: ProjectWorkspaceShellProps) {
    const shellRef = React.useRef<HTMLDivElement>(null);
    const [shellHeight, setShellHeight] = React.useState(640);
    const [headerHeight, setHeaderHeight] = React.useState(DEFAULT_HEADER_PX);
    const [isResizing, setIsResizing] = React.useState(false);
    const dragRef = React.useRef<{
        startY: number;
        startH: number;
    } | null>(null);
    React.useEffect(() => {
        const stored = readStoredHeight(projectId);
        setHeaderHeight(clampHeaderHeight(stored ?? DEFAULT_HEADER_PX, window.innerHeight));
    }, [projectId]);
    React.useEffect(() => {
        const el = shellRef.current;
        if (!el)
            return;
        const ro = new ResizeObserver((entries) => {
            const h = entries[0]?.contentRect.height;
            if (h > 0)
                setShellHeight(h);
        });
        ro.observe(el);
        return () => ro.disconnect();
    }, []);
    const contentHeightPx = Math.max(200, shellHeight - headerHeight);
    const layoutValue: ProjectWorkspaceLayout = React.useMemo(() => ({
        headerHeightPx: headerHeight,
        contentHeightPx,
        headerDensity: densityFromHeight(headerHeight, HEADER_TIGHT_MAX, HEADER_ROOMY_MIN),
        contentDensity: densityFromHeight(contentHeightPx, CONTENT_TIGHT_MAX, CONTENT_ROOMY_MIN),
        isResizing,
    }), [headerHeight, contentHeightPx, isResizing]);
    React.useEffect(() => {
        function onMove(e: PointerEvent) {
            if (!dragRef.current)
                return;
            const delta = e.clientY - dragRef.current.startY;
            setHeaderHeight(clampHeaderHeight(dragRef.current.startH + delta, window.innerHeight));
        }
        function onUp(e: PointerEvent) {
            if (!dragRef.current)
                return;
            const delta = e.clientY - dragRef.current.startY;
            const next = clampHeaderHeight(dragRef.current.startH + delta, window.innerHeight);
            dragRef.current = null;
            setIsResizing(false);
            setHeaderHeight(next);
            writeStoredHeight(projectId, next);
        }
        if (isResizing) {
            document.body.style.cursor = "row-resize";
            document.body.style.userSelect = "none";
            window.addEventListener("pointermove", onMove);
            window.addEventListener("pointerup", onUp);
            window.addEventListener("pointercancel", onUp);
        }
        return () => {
            document.body.style.cursor = "";
            document.body.style.userSelect = "";
            window.removeEventListener("pointermove", onMove);
            window.removeEventListener("pointerup", onUp);
            window.removeEventListener("pointercancel", onUp);
        };
    }, [isResizing, projectId]);
    function onTabBorderPointerDown(e: React.PointerEvent<HTMLButtonElement>) {
        e.preventDefault();
        dragRef.current = { startY: e.clientY, startH: headerHeight };
        setIsResizing(true);
        e.currentTarget.setPointerCapture(e.pointerId);
    }
    function resetHeaderHeight() {
        clearStoredHeight(projectId);
        setHeaderHeight(DEFAULT_HEADER_PX);
    }
    const mobileChrome = (<div className={cn("sticky top-20 z-20 border-b py-4 backdrop-blur-md", isClient
            ? "-mx-4 border-stone-200/90 bg-[#fafaf9]/95 px-4 supports-backdrop-filter:bg-[#fafaf9]/90 sm:-mx-6 sm:px-6 lg:-mx-10 lg:px-10"
            : "-mx-5 border-slate-200 bg-[#f8fafc]/95 px-5 supports-backdrop-filter:bg-[#f8fafc]/85 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8")}>
      <div className="px-4 sm:px-5 lg:px-6">
        {headerBeforeTabs}
        <div className="mt-5">{tabs}</div>
      </div>
    </div>);
    return (<ProjectWorkspaceProvider value={layoutValue}>
      <div className="flex h-full min-h-0 flex-1 flex-col overflow-hidden">
        <div className="space-y-6 lg:hidden">
          {mobileChrome}
          <div className="pb-10">{children}</div>
        </div>

        <div ref={shellRef} className={cn("hidden h-full min-h-0 flex-1 flex-col lg:flex", isResizing && "select-none")} style={{
            "--ptx-header-h": `${headerHeight}px`,
            "--ptx-content-h": `${contentHeightPx}px`,
        } as React.CSSProperties}>
        <div className={cn("flex min-h-0 shrink-0 flex-col overflow-hidden", isClient
            ? "-mx-10 bg-[#fafaf9]/95 px-10 backdrop-blur-md supports-backdrop-filter:bg-[#fafaf9]/90"
            : "-mx-5 bg-[#f8fafc]/95 px-5 backdrop-blur-md supports-backdrop-filter:bg-[#f8fafc]/85 sm:-mx-7 sm:px-7 lg:-mx-8 lg:px-8", !isResizing && "transition-[height] duration-200 ease-out")} style={{ height: headerHeight }}>
          <ProjectHeaderPane headerHeightPx={headerHeight} isResizing={isResizing}>
            {headerBeforeTabs}
          </ProjectHeaderPane>

          <TabRowResizeEdge isClient={isClient} isResizing={isResizing} headerHeightPx={headerHeight} onPointerDown={onTabBorderPointerDown} onDoubleClick={resetHeaderHeight}>
            <div className="px-4 sm:px-5 lg:px-6">{tabs}</div>
          </TabRowResizeEdge>
        </div>

          <ProjectWorkspaceBody density={layoutValue.contentDensity} isResizing={isResizing}>
            {children}
          </ProjectWorkspaceBody>
        </div>
      </div>
    </ProjectWorkspaceProvider>);
}
function ProjectWorkspaceBody({ children, density, isResizing, }: {
    children: React.ReactNode;
    density: ProjectWorkspaceLayout["contentDensity"];
    isResizing: boolean;
}) {
    return (<div data-content-density={density} className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", !isResizing && "transition-[flex] duration-200 ease-out")}>
      <div className={cn("flex min-h-0 flex-1 flex-col overflow-y-auto", density === "tight" ? "px-0 pb-6 pt-1" : density === "roomy" ? "px-0 pb-12 pt-2" : "px-0 pb-10 pt-1.5")}>
        {children}
      </div>
    </div>);
}
function TabRowResizeEdge({ children, isClient, isResizing, headerHeightPx, onPointerDown, onDoubleClick, }: {
    children: React.ReactNode;
    isClient: boolean;
    isResizing: boolean;
    headerHeightPx: number;
    onPointerDown: (e: React.PointerEvent<HTMLButtonElement>) => void;
    onDoubleClick: () => void;
}) {
    const tier = headerVisualTierFromHeight(headerHeightPx);
    return (<div className={cn("relative shrink-0 border-b transition-[margin,padding] duration-150", isClient ? "border-stone-200/90" : "border-slate-200", isResizing && (isClient ? "border-amber-400/80" : "border-[#d97706]/70"), tier === "minimal" && "mt-1.5", tier === "tight" && "mt-2", tier === "balanced" && "mt-3", tier === "roomy" && "mt-4", tier === "minimal" && "[&_nav_a]:!py-1.5 [&_nav_a]:!text-[9px]", tier === "tight" && "[&_nav_a]:!py-2 [&_nav_a]:!text-[10px]", tier === "roomy" && "[&_nav_a]:sm:!py-3.5")}>
      {children}
      <button type="button" onPointerDown={onPointerDown} onDoubleClick={onDoubleClick} title="Drag the tab border to resize · Double-click to reset" aria-label="Drag the line below the project tabs to resize header height" className={cn("absolute inset-x-0 -bottom-px z-10 hidden h-[5px] cursor-row-resize lg:block", "touch-none", "hover:bg-[#d97706]/15", isResizing && (isClient ? "bg-amber-400/35" : "bg-[#d97706]/30"))}/>
    </div>);
}
