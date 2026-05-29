"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, LogOut, Search } from "lucide-react";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { DashboardNotificationBell } from "@/components/shared/dashboard-notification-bell";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { logout } from "@/services/auth-service";
import type { Profile } from "@/types/database";
type ClientHeaderProps = {
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
        return { kicker: "Home", title: "Overview" };
    }
    if (pathname === ROUTES.PROJECTS) {
        return { kicker: "Portfolio", title: "Your projects" };
    }
    if (pathname.startsWith(`${ROUTES.PROJECTS}/`) && pathname.split("/").length > 3) {
        return { kicker: "Engagement", title: "Project workspace" };
    }
    if (pathname.startsWith(`${ROUTES.PROJECTS}/`)) {
        return { kicker: "Portfolio", title: "Project overview" };
    }
    if (pathname === ROUTES.ACCOUNT) {
        return { kicker: "Profile", title: "Your account" };
    }
    return { kicker: "Client portal", title: "ProximaTrax" };
}
export function ClientHeader({ profile }: ClientHeaderProps) {
    const pathname = usePathname();
    const { kicker, title } = titleForPath(pathname);
    async function handleLogout() {
        try {
            await logout();
        }
        catch {
        }
        window.location.replace(ROUTES.LOGIN);
    }
    return (<header className="sticky top-0 z-30 border-b border-stone-200/90 bg-[#fafaf9]/90 px-4 py-3.5 backdrop-blur-xl sm:px-6 sm:py-4">
      <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between lg:gap-6">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-stone-500">
            {kicker}
          </p>
          <h1 className="mt-0.5 font-heading text-xl font-semibold tracking-tight text-stone-900 sm:text-2xl">
            {title}
          </h1>
        </div>

        <div className="hidden w-full max-w-lg flex-col gap-2 md:flex md:flex-row md:items-center">
          <div className="flex min-w-0 flex-1 items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.6)]">
            <Search className="h-4 w-4 shrink-0 text-stone-400" aria-hidden/>
            <Input type="search" placeholder="Search your projects…" className="h-8 border-0 bg-transparent px-0 text-sm shadow-none placeholder:text-stone-400 focus-visible:ring-0"/>
          </div>
          <ProjectSwitcher className="shrink-0"/>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <DashboardNotificationBell userId={profile.id} variant="client"/>
          <DropdownMenu>
            <DropdownMenuTrigger type="button" aria-label={`Account menu for ${profile.full_name}`} className={cn("inline-flex h-10 max-w-[min(100vw-8rem,16rem)] items-center gap-2 rounded-xl border border-stone-200 bg-white px-2 py-1.5 text-left text-sm shadow-sm outline-none transition-colors select-none", "hover:bg-stone-50 focus-visible:border-amber-500/40 focus-visible:ring-[3px] focus-visible:ring-amber-500/20", "data-popup-open:border-stone-300 data-popup-open:bg-stone-50")}>
              <Avatar size="sm" className="ring-1 ring-stone-200/80">
                {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt=""/> : null}
                <AvatarFallback className="bg-stone-800 text-[10px] font-semibold text-white">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium text-stone-900 max-sm:hidden">
                {profile.full_name}
              </span>
              <ChevronDown className="size-4 shrink-0 text-stone-400" aria-hidden/>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 rounded-xl border-stone-200 p-1.5">
              <div className="flex items-start gap-3 rounded-lg px-2 py-2.5">
                <Avatar size="default" className="ring-1 ring-stone-200/80">
                  {profile.avatar_url ? <AvatarImage src={profile.avatar_url} alt=""/> : null}
                  <AvatarFallback className="bg-stone-800 text-xs font-semibold text-white">
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-semibold leading-tight text-stone-900">
                    {profile.full_name}
                  </p>
                  <p className="mt-1 text-xs text-stone-500">Client access · view only</p>
                </div>
              </div>
              <DropdownMenuSeparator className="my-1.5 bg-stone-200/80"/>
              <DropdownMenuItem variant="destructive" className="cursor-pointer gap-2 rounded-lg px-2 py-2 text-sm" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden/>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>);
}
