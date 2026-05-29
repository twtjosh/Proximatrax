"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Plus, Search } from "lucide-react";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { DashboardNotificationBell } from "@/components/shared/dashboard-notification-bell";
import { RoleBadge } from "@/components/shared/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import { PM_BTN_FILLED } from "@/lib/pm-theme";
import { cn } from "@/lib/utils";
import { logout } from "@/services/auth-service";
import type { Profile } from "@/types/database";
type PmHeaderProps = {
    profile: Profile;
};
function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
function titleForPath(pathname: string): {
    kicker: string;
    title: string;
} {
    if (pathname === ROUTES.DASHBOARD || pathname === `${ROUTES.DASHBOARD}/`) {
        return { kicker: "Operations", title: "Overview" };
    }
    if (pathname === `${ROUTES.PROJECTS}/new`) {
        return { kicker: "Projects", title: "New engagement" };
    }
    if (pathname === ROUTES.PROJECTS) {
        return { kicker: "Portfolio", title: "All projects" };
    }
    if (pathname.startsWith(`${ROUTES.PROJECTS}/`)) {
        return { kicker: "Engagement", title: "Project workspace" };
    }
    if (pathname === ROUTES.TEAM || pathname.startsWith(`${ROUTES.TEAM}/`)) {
        return { kicker: "People", title: "Team directory" };
    }
    if (pathname === ROUTES.ACCOUNT || pathname.startsWith(`${ROUTES.ACCOUNT}/`)) {
        return { kicker: "Profile", title: "Your account" };
    }
    return { kicker: "Operations", title: "Workspace" };
}
export function PmHeader({ profile }: PmHeaderProps) {
    const pathname = usePathname();
    const { kicker, title } = titleForPath(pathname);
    const isDashboard = pathname === ROUTES.DASHBOARD || pathname === `${ROUTES.DASHBOARD}/`;
    async function handleLogout() {
        try {
            await logout();
        }
        catch {
        }
        window.location.replace(ROUTES.LOGIN);
    }
    return (<header className="sticky top-0 z-30 border-b-2 border-copper/20 bg-white/92 px-4 py-3 shadow-[0_4px_20px_-12px_rgba(15,23,42,0.15)] backdrop-blur-xl sm:px-6">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-5">
        {!isDashboard ? (<div className="min-w-0 shrink-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-copper">
              {kicker}
            </p>
            <h1 className="mt-0.5 font-heading text-xl font-semibold tracking-tight text-ink sm:text-[1.35rem]">
              {title}
            </h1>
          </div>) : (<div className="min-w-0 shrink-0 lg:flex-1">
            <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-copper">
              AEG Fashion · Operations
            </p>
          </div>)}

        <div className="flex w-full min-w-0 flex-1 flex-col gap-2 sm:flex-row sm:items-center lg:max-w-2xl">
          <label className="flex min-w-0 flex-1 cursor-text items-center gap-2 rounded-full border-2 border-slate-200 bg-slate-50/80 px-4 py-2 shadow-[inset_0_1px_3px_rgba(15,23,42,0.06)] transition-colors focus-within:border-copper/40 focus-within:bg-white focus-within:ring-2 focus-within:ring-copper/15">
            <Search className="h-4 w-4 shrink-0 text-muted-ink" aria-hidden/>
            <Input type="search" placeholder="Search projects, tasks, messages…" className="h-7 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-muted-ink/70 focus-visible:ring-0"/>
          </label>
          <ProjectSwitcher className="shrink-0 !rounded-full !border-2"/>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-2.5">
          <Link href={`${ROUTES.PROJECTS}/new`} className={cn(PM_BTN_FILLED, "h-9 px-3.5 text-xs sm:h-10 sm:px-4 sm:text-sm")}>
            <Plus className="h-4 w-4" strokeWidth={2.5}/>
            <span className="max-sm:hidden">New project</span>
            <span className="sm:hidden">New</span>
          </Link>

          <DashboardNotificationBell userId={profile.id} variant="pm"/>

          <DropdownMenu>
            <DropdownMenuTrigger type="button" aria-label={`Account menu for ${profile.full_name}`} className={cn("inline-flex h-10 max-w-[min(100vw-10rem,15rem)] cursor-pointer items-center gap-2 rounded-full border-2 border-slate-200 bg-white pl-1.5 pr-3 py-1 text-left text-sm shadow-sm outline-none transition-all select-none", "hover:border-copper/35 hover:bg-copper-soft/20 hover:shadow-md", "focus-visible:border-copper/45 focus-visible:ring-[3px] focus-visible:ring-copper/20", "data-popup-open:border-copper/40 data-popup-open:bg-copper-soft/25")}>
              <Avatar size="sm" className="ring-2 ring-slate-100">
                {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt=""/> : null}
                <AvatarFallback className="bg-navy text-[10px] font-semibold text-white">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-semibold text-ink max-sm:hidden">
                {profile.full_name}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-ink" aria-hidden/>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 rounded-2xl border-slate-200 p-1.5">
              <div className="flex items-start gap-3 rounded-xl px-2 py-2.5">
                <Avatar size="default" className="ring-2 ring-slate-100">
                  {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt=""/> : null}
                  <AvatarFallback className="bg-navy text-xs font-semibold text-white">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate font-semibold leading-none text-foreground">
                    {profile.full_name}
                  </p>
                  <RoleBadge role={profile.role}/>
                </div>
              </div>
              <DropdownMenuSeparator className="my-1.5 bg-border/80"/>
              <DropdownMenuItem variant="destructive" className="cursor-pointer gap-2 rounded-xl px-2 py-2 text-sm" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden/>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>);
}
