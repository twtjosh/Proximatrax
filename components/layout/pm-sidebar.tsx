"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, LayoutDashboard, Sparkles, UserCircle, Users2, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROUTES } from "@/lib/constants";
import { PM_SIDEBAR_LINK_ACTIVE, PM_SIDEBAR_LINK_HOVER } from "@/lib/pm-theme";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import type { Profile } from "@/types/database";
const navigationItems = [
    { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
    { href: ROUTES.PROJECTS, label: "Projects", icon: Building2 },
    { href: ROUTES.TEAM, label: "Team", icon: Users2 },
    { href: ROUTES.ACCOUNT, label: "Account", icon: UserCircle },
] as const;
type PmSidebarProps = {
    profile: Profile;
};
export function PmSidebar({ profile }: PmSidebarProps) {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebarStore();
    return (<aside className={cn("sticky top-0 hidden h-svh max-h-svh shrink-0 flex-col overflow-y-auto border-r border-navy-deep/80 bg-linear-to-b from-navy via-[#1a2744] to-navy-deep text-slate-200 shadow-[4px_0_24px_-8px_rgba(15,23,42,0.35)] transition-[width] duration-200 md:flex", isCollapsed ? "w-[4.25rem]" : "w-[16.5rem]")}>
      <div className={cn("flex shrink-0 border-b border-white/10", isCollapsed
            ? "flex-col items-center gap-2 px-2 py-3"
            : "h-14 flex-row items-center justify-between gap-2 px-3")}>
        <Link href={ROUTES.DASHBOARD} className={cn("flex cursor-pointer items-center gap-2.5 rounded-xl py-1 outline-none transition-opacity hover:opacity-90 focus-visible:ring-2 focus-visible:ring-copper/50 focus-visible:ring-offset-2 focus-visible:ring-offset-navy", isCollapsed ? "justify-center" : "min-w-0 flex-1")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-copper text-[10px] font-bold tracking-tight text-white shadow-[0_2px_8px_rgba(217,119,6,0.45)] ring-1 ring-amber-400/30">
            PT
          </div>
          {!isCollapsed ? (<div className="min-w-0 flex-1">
              <span className="block truncate font-heading text-[15px] font-semibold tracking-tight text-white">
                ProximaTrax
              </span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-amber-200/75">
                <Sparkles className="h-3 w-3 shrink-0 text-copper" aria-hidden/>
                PM workspace
              </span>
            </div>) : null}
        </Link>

        <Button type="button" size="icon-sm" variant="ghost" onClick={toggleSidebar} className="shrink-0 cursor-pointer text-slate-400 hover:bg-white/10 hover:text-white" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? (<ChevronRight className="h-4 w-4"/>) : (<ChevronLeft className="h-4 w-4"/>)}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2.5" aria-label="Project manager">
        {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
                (item.href === ROUTES.PROJECTS && pathname.startsWith(`${ROUTES.PROJECTS}/`)) ||
                (item.href === ROUTES.TEAM && pathname.startsWith(`${ROUTES.TEAM}/`));
            return (<Link key={item.href} href={item.href} className={cn("group relative flex items-center gap-3 px-3 py-2.5 text-[13px] outline-none", isActive ? PM_SIDEBAR_LINK_ACTIVE : PM_SIDEBAR_LINK_HOVER, isCollapsed && "justify-center px-2")} title={isCollapsed ? item.label : undefined}>
              <span className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg transition-colors", isActive
                    ? "bg-copper/20 text-copper"
                    : "bg-white/5 text-slate-400 group-hover:text-white")}>
                <Icon className="h-[17px] w-[17px]" aria-hidden/>
              </span>
              {!isCollapsed ? (<span className="min-w-0 flex-1 truncate">{item.label}</span>) : null}
              {!isCollapsed && isActive ? (<span className="h-1.5 w-1.5 shrink-0 rounded-full bg-copper" aria-hidden/>) : null}
            </Link>);
        })}
      </nav>

      <div className="shrink-0 border-t border-white/10 p-2.5">
        <div className={cn("flex cursor-default items-center gap-3 rounded-xl bg-white/6 px-2.5 py-2.5 ring-1 ring-white/10", isCollapsed && "justify-center bg-transparent px-0 ring-0")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-linear-to-br from-copper to-amber-700 text-[10px] font-semibold text-white shadow-sm">
            {profile.full_name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          </div>
          {!isCollapsed ? (<div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-white">{profile.full_name}</p>
              <p className="mt-0.5 truncate text-xs text-slate-400">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>) : null}
        </div>
      </div>
    </aside>);
}
