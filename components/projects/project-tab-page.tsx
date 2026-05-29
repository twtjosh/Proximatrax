"use client";
import { ProjectWorkspacePage, ProjectWorkspacePageIntro, } from "@/components/projects/project-workspace-context";
import { cn } from "@/lib/utils";
type ProjectTabPageProps = {
    kicker?: string;
    title: string;
    description?: string;
    children: React.ReactNode;
    fill?: boolean;
    hideIntroOnDesktop?: boolean;
    className?: string;
};
export function ProjectTabPage({ kicker, title, description, children, fill = true, hideIntroOnDesktop = false, className, }: ProjectTabPageProps) {
    return (<ProjectWorkspacePage fill={fill} className={cn(fill && "h-full min-h-0", className)}>
      <ProjectWorkspacePageIntro kicker={kicker} title={title} description={description} className={hideIntroOnDesktop ? "lg:hidden" : undefined}/>
      <div className={cn(fill && "flex min-h-0 flex-1 flex-col")}>{children}</div>
    </ProjectWorkspacePage>);
}
