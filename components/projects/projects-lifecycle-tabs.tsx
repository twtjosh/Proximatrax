"use client";
import Link from "next/link";
import { Archive, FolderKanban } from "lucide-react";
import { projectsListPath, type ProjectsListView } from "@/lib/constants";
import { cn } from "@/lib/utils";
type ProjectsLifecycleTabsProps = {
    view: ProjectsListView;
    activeCount: number;
    completedCount: number;
    variant?: "pm" | "client" | "middleman";
};
export function ProjectsLifecycleTabs({ view, activeCount, completedCount, variant = "pm", }: ProjectsLifecycleTabsProps) {
    const isClient = variant === "client";
    const tabs: Array<{
        id: ProjectsListView;
        label: string;
        count: number;
        icon: typeof FolderKanban;
    }> = [
        {
            id: "active",
            label: isClient ? "Active engagements" : "Active",
            count: activeCount,
            icon: FolderKanban,
        },
        {
            id: "completed",
            label: isClient ? "Completed archive" : "Completed",
            count: completedCount,
            icon: Archive,
        },
    ];
    return (<nav aria-label="Project lifecycle" className={cn("inline-flex flex-wrap gap-1 rounded-xl border p-1", isClient
            ? "border-stone-200/90 bg-stone-50/80"
            : "border-slate-200/90 bg-slate-50/80")}>
      {tabs.map((tab) => {
            const Icon = tab.icon;
            const selected = view === tab.id;
            return (<Link key={tab.id} href={projectsListPath(tab.id)} aria-current={selected ? "page" : undefined} className={cn("inline-flex items-center gap-2 rounded-lg px-3.5 py-2 text-sm font-medium transition-colors", selected
                    ? isClient
                        ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/80"
                        : "bg-white text-slate-900 shadow-sm ring-1 ring-slate-200/80"
                    : isClient
                        ? "text-stone-600 hover:bg-white/70 hover:text-stone-900"
                        : "text-slate-600 hover:bg-white/70 hover:text-slate-900")}>
            <Icon className="h-4 w-4 shrink-0 opacity-70" aria-hidden/>
            {tab.label}
            <span className={cn("rounded-full px-1.5 py-0.5 text-[11px] tabular-nums", selected
                    ? isClient
                        ? "bg-stone-100 text-stone-700"
                        : "bg-slate-100 text-slate-700"
                    : "bg-black/5 text-current")}>
              {tab.count}
            </span>
          </Link>);
        })}
    </nav>);
}
