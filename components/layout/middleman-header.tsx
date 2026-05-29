"use client";
import { ChevronDown, LogOut } from "lucide-react";
import { DashboardNotificationBell } from "@/components/shared/dashboard-notification-bell";
import { RoleBadge } from "@/components/shared/role-badge";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { logout } from "@/services/auth-service";
import type { Profile } from "@/types/database";
type MiddlemanHeaderProps = {
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
export function MiddlemanHeader({ profile }: MiddlemanHeaderProps) {
    async function handleLogout() {
        try {
            await logout();
        }
        catch {
        }
        window.location.replace(ROUTES.LOGIN);
    }
    return (<header className="sticky top-0 z-30 border-b border-slate-200 bg-white/95 px-4 py-3 text-slate-950 backdrop-blur-xl sm:px-5 sm:py-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-[#d97706]">
            ProximaTrax · Field workspace
          </p>
          <h1 className="mt-1 font-heading text-xl font-semibold tracking-tight sm:text-2xl">
            Field workspace
          </h1>
          <p className="mt-1 max-w-xl text-xs text-slate-600 sm:text-sm">
            Open a project from the list below or from My projects — work lives on each site&apos;s
            board and messages.
          </p>
        </div>

        <div className="hidden w-full max-w-md flex-col gap-2 lg:flex lg:flex-row lg:items-center">
          <ProjectSwitcher className="shrink-0"/>
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          <DashboardNotificationBell userId={profile.id} variant="middleman"/>
          <DropdownMenu>
            <DropdownMenuTrigger type="button" aria-label={`Account menu for ${profile.full_name}`} className={cn("inline-flex h-9 max-w-[min(100vw-8rem,16rem)] items-center gap-2 rounded-xl border px-1.5 py-1 text-left text-sm shadow-none outline-none select-none", "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50", "data-popup-open:border-border data-popup-open:bg-muted/80 data-popup-open:shadow-sm", "border-slate-200 bg-white text-slate-950 hover:bg-slate-50")}>
              <Avatar size="sm" className="ring-1 ring-black/5">
                {profile.avatar_url ? (<AvatarImage src={profile.avatar_url} alt=""/>) : null}
                <AvatarFallback className="bg-slate-800 text-[10px] font-semibold text-white">
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium max-sm:hidden">
                {profile.full_name}
              </span>
              <ChevronDown className="size-4 shrink-0 text-slate-500 opacity-80" aria-hidden/>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 p-1.5 sm:min-w-60">
              <div className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2.5 sm:px-2.5">
                <Avatar size="default" className="ring-1 ring-black/5">
                  {profile.avatar_url ? (<AvatarImage src={profile.avatar_url} alt=""/>) : null}
                  <AvatarFallback className="bg-slate-800 text-xs font-semibold text-white">
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
              <DropdownMenuItem variant="destructive" className="cursor-pointer gap-2 rounded-md px-2 py-2 text-sm" onClick={handleLogout}>
                <LogOut className="size-4" aria-hidden/>
                Log out
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>);
}
