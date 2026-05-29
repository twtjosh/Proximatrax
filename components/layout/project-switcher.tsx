"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { projectPath, projectsListPath, ROUTES } from "@/lib/constants";
import { splitProjectsByLifecycle } from "@/lib/project-lifecycle";
import { cn } from "@/lib/utils";
import { listProjects, type ProjectWithRelations } from "@/services/project-service";
const PROJECT_ROUTE = /^\/projects\/([^/]+)/;
export function ProjectSwitcher({ className }: {
    className?: string;
}) {
    const pathname = usePathname();
    const router = useRouter();
    const match = pathname.match(PROJECT_ROUTE);
    const currentId = match?.[1];
    const [projects, setProjects] = React.useState<ProjectWithRelations[]>([]);
    React.useEffect(() => {
        void listProjects()
            .then((all) => {
            const { active, completed } = splitProjectsByLifecycle(all);
            const viewingArchived = currentId != null && completed.some((p) => p.id === currentId);
            setProjects(viewingArchived
                ? [
                    ...completed.filter((p) => p.id === currentId),
                    ...active,
                ]
                : active);
        })
            .catch(() => setProjects([]));
    }, [currentId]);
    if (!currentId || currentId === "new" || projects.length === 0)
        return null;
    const current = projects.find((p) => p.id === currentId);
    return (<DropdownMenu>
      <DropdownMenuTrigger type="button" className={cn("hidden h-9 max-w-[14rem] items-center gap-2 rounded-full border-2 border-slate-200/90 bg-white px-3.5 text-left text-xs font-semibold text-slate-800 shadow-sm outline-none transition-all hover:border-copper/40 hover:bg-copper-soft/20 lg:inline-flex", className)}>
        <span className="min-w-0 flex-1 truncate font-heading text-sm tracking-tight">
          {current?.title ?? "Project"}
        </span>
        <ChevronDown className="h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden/>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="max-h-72 w-[min(100vw-2rem,18rem)] overflow-y-auto rounded-none p-1">
        {projects.map((p) => (<DropdownMenuItem key={p.id} className={cn("cursor-pointer rounded-none px-2 py-2 text-sm", p.id === currentId && "bg-slate-100")} onClick={() => router.push(projectPath(p.id))}>
            <span className="truncate">{p.title}</span>
          </DropdownMenuItem>))}
        <DropdownMenuItem className="cursor-pointer rounded-none px-2 py-2 text-xs text-slate-500" onClick={() => router.push(projectsListPath("completed"))}>
          Completed archive
        </DropdownMenuItem>
        <DropdownMenuItem className="cursor-pointer rounded-none px-2 py-2 text-xs text-slate-500" onClick={() => router.push(ROUTES.PROJECTS)}>
          All active projects
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
