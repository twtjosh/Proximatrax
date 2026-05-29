"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, Inbox, LayoutDashboard, Settings, UserCircle, Users, Users2, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROUTES } from "@/lib/constants";
import { PM_SIDEBAR_LINK_ACTIVE, PM_SIDEBAR_LINK_HOVER } from "@/lib/pm-theme";
import { triageCounts, type InquiryTriageRow } from "@/lib/inquiry-triage";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";
type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutDashboard;
    roles: UserRole[];
};
const navigationItems: NavItem[] = [
    {
        href: ROUTES.DASHBOARD,
        label: "Dashboard",
        icon: LayoutDashboard,
        roles: ["super_admin", "project_manager", "client"],
    },
    {
        href: ROUTES.INQUIRIES,
        label: "Inquiries",
        icon: Inbox,
        roles: ["super_admin"],
    },
    {
        href: ROUTES.PROJECTS,
        label: "Projects",
        icon: Building2,
        roles: ["project_manager", "client"],
    },
    {
        href: ROUTES.TEAM,
        label: "Team",
        icon: Users2,
        roles: ["project_manager", "client"],
    },
    {
        href: ROUTES.ACCOUNT,
        label: "Account",
        icon: UserCircle,
        roles: ["project_manager", "middleman", "client"],
    },
    {
        href: ROUTES.SETTINGS,
        label: "Settings",
        icon: Settings,
        roles: ["super_admin"],
    },
];
type SidebarProps = {
    profile: Profile;
    inquirySummaries?: InquiryTriageRow[];
    viewedInquiryIds?: string[];
};
export function Sidebar({ profile, inquirySummaries, viewedInquiryIds = [], }: SidebarProps) {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebarStore();
    const isPm = profile.role === "project_manager";
    const visibleItems = navigationItems.filter((item) => item.roles.includes(profile.role));
    const inquiryCounts = React.useMemo(() => {
        if (!inquirySummaries?.length) {
            return { totalUnopened: 0, newUnopened: 0 };
        }
        return triageCounts(inquirySummaries, viewedInquiryIds);
    }, [inquirySummaries, viewedInquiryIds]);
    return (<aside className={cn("sticky top-0 hidden h-svh max-h-svh shrink-0 flex-col overflow-y-auto border-r transition-[width] duration-200 md:flex", isPm
            ? "w-[15.5rem] border-navy-soft bg-linear-to-b from-navy to-navy-deep text-slate-200"
            : "w-60 border-border bg-background", isCollapsed && (isPm ? "w-[4.25rem]" : "w-16"))}>
      <div className={cn("flex shrink-0 border-b", isPm ? "border-white/10" : "border-border", isCollapsed
            ? "flex-col items-center gap-2 px-2 py-3"
            : "h-[3.75rem] flex-row items-center justify-between gap-2 px-3")}>
        <Link href={ROUTES.DASHBOARD} className={cn("flex items-center gap-2.5 rounded-lg py-1.5 outline-none transition-colors focus-visible:ring-2", isPm ? "focus-visible:ring-copper/40" : "focus-visible:ring-ring", isCollapsed ? "justify-center" : "min-w-0 flex-1")}>
          <div className={cn("flex h-9 w-9 shrink-0 items-center justify-center rounded-lg", isPm
            ? "bg-copper-soft text-copper ring-1 ring-copper/30"
            : "border border-border bg-muted text-muted-foreground")}>
            <Building2 className="h-4 w-4" aria-hidden/>
          </div>
          {!isCollapsed ? (<div className="min-w-0">
              <span className={cn("block truncate font-heading text-[15px] font-semibold tracking-tight", isPm ? "text-white" : "text-foreground")}>
                ProximaTrax
              </span>
              {isPm ? (<span className="block truncate text-[10px] font-medium uppercase tracking-[0.14em] text-slate-400">
                  Operations
                </span>) : null}
            </div>) : null}
        </Link>

        <Button type="button" size="icon-sm" variant="ghost" onClick={toggleSidebar} className={cn("shrink-0", isPm
            ? "text-slate-400 transition-colors hover:bg-copper-soft/20 hover:text-white"
            : "text-muted-foreground hover:bg-muted hover:text-foreground")} aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? (<ChevronRight className="h-4 w-4"/>) : (<ChevronLeft className="h-4 w-4"/>)}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2.5" aria-label="Primary">
        {visibleItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href || pathname.startsWith(`${item.href}/`);
            const showInquiryBadges = item.href === ROUTES.INQUIRIES && inquirySummaries !== undefined;
            return (<Link key={item.href} href={item.href} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all", isPm
                    ? isActive
                        ? PM_SIDEBAR_LINK_ACTIVE
                        : PM_SIDEBAR_LINK_HOVER
                    : isActive
                        ? "bg-muted font-medium text-foreground"
                        : "text-muted-foreground hover:bg-muted/70 hover:text-foreground", isCollapsed && "justify-center px-2")} title={isCollapsed ? item.label : undefined}>
              <Icon className={cn("h-[18px] w-[18px] shrink-0", isPm && isActive && "text-copper")} aria-hidden/>
              {!isCollapsed ? (<>
                  <span className="min-w-0 flex-1 truncate">{item.label}</span>
                  {showInquiryBadges && inquiryCounts.totalUnopened > 0 ? (<span className="ml-auto flex min-h-5 min-w-5 shrink-0 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold tabular-nums text-white dark:bg-rose-500" title={inquiryCounts.newUnopened > 0
                            ? `${inquiryCounts.totalUnopened} waiting for a first look (${inquiryCounts.newUnopened} new)`
                            : `${inquiryCounts.totalUnopened} waiting for a first look`}>
                      {inquiryCounts.totalUnopened > 99 ? "99+" : inquiryCounts.totalUnopened}
                    </span>) : null}
                </>) : null}
              {isCollapsed && showInquiryBadges && inquiryCounts.totalUnopened > 0 ? (<span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-sm bg-rose-600 px-1 text-[9px] font-bold leading-none text-white">
                  {inquiryCounts.totalUnopened > 99 ? "99+" : inquiryCounts.totalUnopened}
                </span>) : null}
            </Link>);
        })}
      </nav>

      <div className={cn("shrink-0 border-t p-2.5", isPm ? "border-white/10" : "border-border")}>
        <div className={cn("flex items-center gap-3 rounded-xl px-2.5 py-2.5", isPm ? "bg-navy-soft/50 ring-1 ring-white/10" : "border border-border bg-muted/40", isCollapsed && (isPm ? "justify-center bg-transparent ring-0" : "justify-center border-0 bg-transparent px-0"))}>
          <div className={cn("flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-xs font-semibold", isPm ? "bg-copper text-white" : "bg-foreground text-background")}>
            {profile.full_name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          </div>
          {!isCollapsed ? (<div className="min-w-0 flex-1">
              <p className={cn("truncate text-sm font-medium", isPm ? "text-white" : "text-foreground")}>
                {profile.full_name}
              </p>
              <p className={cn("mt-0.5 flex items-center gap-1.5 truncate text-xs", isPm ? "text-slate-400" : "text-muted-foreground")}>
                <Users className="h-3 w-3 shrink-0" aria-hidden/>
                <span>{ROLE_LABELS[profile.role]}</span>
              </p>
            </div>) : null}
        </div>
      </div>
    </aside>);
}
