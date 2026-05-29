"use client";
import * as React from "react";
import { cn } from "@/lib/utils";
export type WorkspaceDensity = "tight" | "balanced" | "roomy";
export type ProjectWorkspaceLayout = {
    headerHeightPx: number;
    contentHeightPx: number;
    headerDensity: WorkspaceDensity;
    contentDensity: WorkspaceDensity;
    isResizing: boolean;
};
const ProjectWorkspaceContext = React.createContext<ProjectWorkspaceLayout | null>(null);
export function densityFromHeight(px: number, tightMax: number, roomyMin: number): WorkspaceDensity {
    if (px < tightMax)
        return "tight";
    if (px >= roomyMin)
        return "roomy";
    return "balanced";
}
export function ProjectWorkspaceProvider({ value, children, }: {
    value: ProjectWorkspaceLayout;
    children: React.ReactNode;
}) {
    return (<ProjectWorkspaceContext.Provider value={value}>
      {children}
    </ProjectWorkspaceContext.Provider>);
}
export function useProjectWorkspace() {
    const ctx = React.useContext(ProjectWorkspaceContext);
    return ctx;
}
export function ProjectWorkspacePage({ children, className, fill = true, }: {
    children: React.ReactNode;
    className?: string;
    fill?: boolean;
}) {
    const layout = useProjectWorkspace();
    return (<div data-content-density={layout?.contentDensity ?? "balanced"} className={cn("project-workspace-page", fill && "flex min-h-0 flex-col", layout?.contentDensity === "tight" && "gap-3", layout?.contentDensity === "balanced" && "gap-4", layout?.contentDensity === "roomy" && "gap-5", className)}>
      {children}
    </div>);
}
export function ProjectWorkspacePageIntro({ kicker, title, description, className, }: {
    kicker?: string;
    title: string;
    description?: string;
    className?: string;
}) {
    const layout = useProjectWorkspace();
    const density = layout?.contentDensity ?? "balanced";
    if (density === "tight") {
        return (<div className={cn("shrink-0 border-b border-slate-200/80 pb-3", className)}>
        <h2 className="font-heading text-base tracking-tight text-slate-950">{title}</h2>
      </div>);
    }
    return (<header className={cn("shrink-0 space-y-1", className)}>
      {kicker ? (<p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          {kicker}
        </p>) : null}
      <h2 className={cn("font-heading tracking-tight text-slate-950", density === "roomy" ? "text-2xl" : "text-xl")}>
        {title}
      </h2>
      {description ? (<p className={cn("max-w-2xl leading-relaxed text-slate-600", density === "roomy" ? "text-sm" : "text-xs")}>
          {description}
        </p>) : null}
    </header>);
}
