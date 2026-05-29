"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { projectMessagesPath } from "@/lib/constants";
import { projectWorkspaceTabs } from "@/lib/project-view-policy";
import { cn } from "@/lib/utils";
import type { UserRole } from "@/types/enums";
export function ProjectTabs({ projectId, viewerRole, viewerId, initialUnreadChatCount, }: {
    projectId: string;
    viewerRole: UserRole;
    viewerId: string;
    initialUnreadChatCount: number;
}) {
    const pathname = usePathname();
    const tabs = projectWorkspaceTabs(projectId, viewerRole);
    const isClient = viewerRole === "client";
    return (<nav className={cn("flex flex-wrap items-center gap-1", isClient
            ? "rounded-xl border border-stone-200/90 bg-stone-50/80 p-1"
            : "gap-0.5 border-b border-slate-200 lg:border-b-0")}>
      {tabs.map((tab) => {
            const isActive = tab.exact
                ? pathname === tab.href
                : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
            return (<Link key={tab.href} href={tab.href} aria-current={isActive ? "page" : undefined} className={cn("relative inline-flex items-center gap-1.5 text-[12px] font-medium transition-colors sm:text-[13px]", isClient
                    ? cn("rounded-lg px-3 py-2 sm:px-3.5 sm:py-2.5", isActive
                        ? "bg-white text-stone-900 shadow-sm ring-1 ring-stone-200/90"
                        : "text-stone-600 hover:bg-white/60 hover:text-stone-900")
                    : cn("-mb-px border-b-2 px-3 py-2.5 font-mono text-[10px] uppercase tracking-[0.16em] sm:px-4 sm:py-3 sm:text-[11px] sm:tracking-[0.18em]", isActive
                        ? "border-[#d97706] text-[#9a4f02]"
                        : "border-transparent text-slate-500 hover:text-slate-900"))}>
            {tab.label}
            {tab.href === projectMessagesPath(projectId) ? (<ChatUnreadBadge projectId={projectId} viewerId={viewerId} initialCount={initialUnreadChatCount}/>) : null}
          </Link>);
        })}
    </nav>);
}
