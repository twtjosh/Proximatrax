"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, Inbox, LayoutDashboard, LogOut, Search, Settings, } from "lucide-react";
import { DashboardNotificationBell } from "@/components/shared/dashboard-notification-bell";
import { NotificationBell } from "@/components/shared/notification-bell";
import { RoleBadge } from "@/components/shared/role-badge";
import { ProjectSwitcher } from "@/components/layout/project-switcher";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ROUTES } from "@/lib/constants";
import type { InquiryTriageRow } from "@/lib/inquiry-triage";
import { cn } from "@/lib/utils";
import { logout } from "@/services/auth-service";
import type { Profile } from "@/types/database";
type HeaderProps = {
    profile: Profile;
    inquirySummaries?: InquiryTriageRow[];
    viewedInquiryIds?: string[];
};
function getInitials(name: string) {
    return name
        .split(" ")
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
function superAdminSectionTitle(pathname: string): string {
    if (pathname === ROUTES.INQUIRIES || pathname.startsWith(`${ROUTES.INQUIRIES}/`)) {
        return "Inquiries";
    }
    if (pathname === ROUTES.SETTINGS || pathname.startsWith(`${ROUTES.SETTINGS}/`)) {
        return "User management";
    }
    return "Overview";
}
export function Header({ profile, inquirySummaries, viewedInquiryIds }: HeaderProps) {
    const pathname = usePathname();
    const isSuperAdmin = profile.role === "super_admin";
    const isPm = profile.role === "project_manager";
    const saSection = superAdminSectionTitle(pathname);
    function pmPageTitle(): string {
        if (pathname === ROUTES.DASHBOARD || pathname === `${ROUTES.DASHBOARD}/`) {
            return "Dashboard";
        }
        if (pathname === ROUTES.PROJECTS || pathname.startsWith(`${ROUTES.PROJECTS}/`)) {
            return "Projects";
        }
        if (pathname === ROUTES.TEAM || pathname.startsWith(`${ROUTES.TEAM}/`)) {
            return "Team";
        }
        if (pathname === ROUTES.ACCOUNT || pathname.startsWith(`${ROUTES.ACCOUNT}/`)) {
            return "Account";
        }
        return "Operations";
    }
    async function handleLogout() {
        try {
            await logout();
        }
        catch {
        }
        window.location.replace(ROUTES.LOGIN);
    }
    return (<header className={cn("sticky top-0 z-30 border-b px-4 py-3 backdrop-blur-xl sm:px-5 sm:py-3.5", isSuperAdmin
            ? "border-slate-200/90 bg-white/95 text-slate-950 dark:border-zinc-800/90 dark:bg-zinc-950/90 dark:text-white"
            : isPm
                ? "border-cool-grey bg-surface-card/95 shadow-[0_1px_0_var(--cool-grey)]"
                : "border-cool-grey bg-surface-card/95")}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
        <div className="min-w-0">
          <p className={cn("text-[11px] font-medium uppercase tracking-[0.16em]", isSuperAdmin
            ? "text-rose-700 dark:text-rose-300/85"
            : "text-copper")}>
            {isSuperAdmin
            ? `SuperAdmin · ${saSection}`
            : isPm
                ? "AEG Fashion · Operations"
                : "Role-Based Workspace"}
          </p>
          <h1 className={cn("mt-0.5 font-heading text-xl font-semibold tracking-tight sm:text-[1.35rem]", isSuperAdmin ? "text-slate-950 dark:text-white" : "text-ink")}>
            {isSuperAdmin
            ? "Dashboard"
            : profile.role === "client"
                ? "Client Portal"
                : isPm
                    ? pmPageTitle()
                    : "Project Operations"}
          </h1>
          {isSuperAdmin ? (<nav className="mt-3 flex flex-wrap gap-2 md:hidden" aria-label="SuperAdmin navigation">
              {([
                {
                    href: ROUTES.DASHBOARD,
                    label: "Dashboard",
                    Icon: LayoutDashboard,
                },
                { href: ROUTES.INQUIRIES, label: "Inquiries", Icon: Inbox },
                { href: ROUTES.SETTINGS, label: "Settings", Icon: Settings },
            ] as const).map(({ href, label, Icon }) => {
                const active = pathname === href || pathname.startsWith(`${href}/`);
                return (<Link key={href} href={href} aria-current={active ? "page" : undefined} className={cn("inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-2 font-mono text-[10px] font-medium uppercase tracking-[0.14em] transition-colors", active
                        ? "border-rose-300 bg-rose-50 text-rose-900 dark:border-rose-500/40 dark:bg-rose-500/15 dark:text-white"
                        : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300 hover:bg-white hover:text-slate-950 dark:border-white/10 dark:bg-zinc-900/50 dark:text-zinc-300 dark:hover:border-white/15 dark:hover:bg-zinc-800/60 dark:hover:text-white")}>
                    <Icon className="h-3.5 w-3.5 shrink-0" aria-hidden/>
                    {label}
                  </Link>);
            })}
            </nav>) : null}
        </div>

        {!isSuperAdmin ? (<div className="hidden w-full max-w-md flex-col gap-2 lg:flex lg:flex-row lg:items-center">
            <div className={cn("flex w-full min-w-0 flex-1 items-center gap-2 px-3 py-2", isPm
                ? "rounded-lg border border-cool-grey bg-surface-spotlight shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]"
                : "border border-cool-grey bg-surface-card")}>
              <Search className="h-4 w-4 shrink-0 text-slate-400"/>
              <Input type="search" placeholder="Search projects, tasks, messages…" className={cn("h-7 border-0 px-0 shadow-none focus-visible:ring-0", isPm ? "rounded-none bg-transparent" : "rounded-none")}/>
            </div>
            <ProjectSwitcher className="shrink-0"/>
          </div>) : null}

        <div className="flex shrink-0 items-center justify-end gap-2 sm:gap-3">
          {isSuperAdmin ? (<NotificationBell inquirySummaries={inquirySummaries ?? []} viewedInquiryIds={viewedInquiryIds ?? []}/>) : (<DashboardNotificationBell userId={profile.id} variant="pm"/>)}
          <DropdownMenu>
            <DropdownMenuTrigger type="button" aria-label={`Account menu for ${profile.full_name}`} className={cn("inline-flex h-9 max-w-[min(100vw-8rem,16rem)] items-center gap-2 rounded-xl border px-1.5 py-1 text-left text-sm shadow-none transition-[color,box-shadow,background-color,border-color] outline-none select-none", "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50", "data-popup-open:border-border data-popup-open:bg-muted/80 data-popup-open:shadow-sm", isSuperAdmin
            ? "border-slate-200/90 bg-white/90 text-slate-950 hover:bg-slate-50 dark:border-zinc-700/90 dark:bg-zinc-900/55 dark:text-white dark:hover:bg-zinc-800/70"
            : isPm
                ? "border-cool-grey bg-surface-card text-ink shadow-sm hover:bg-surface-spotlight"
                : "border-border/80 bg-background/90 text-foreground hover:bg-muted/60 dark:border-input dark:bg-input/25 dark:hover:bg-input/40")}>
              <Avatar size="sm" className="ring-1 ring-black/5 dark:ring-white/10">
                {profile.avatar_url ? (<AvatarImage src={profile.avatar_url} alt=""/>) : null}
                <AvatarFallback className={cn("text-[10px] font-semibold text-white", isSuperAdmin
            ? "bg-linear-to-br from-rose-600 to-rose-900"
            : isPm
                ? "bg-navy text-white"
                : "bg-slate-800")}>
                  {getInitials(profile.full_name)}
                </AvatarFallback>
              </Avatar>
              <span className="min-w-0 flex-1 truncate font-medium max-sm:hidden">
                {profile.full_name}
              </span>
              <ChevronDown className="size-4 shrink-0 text-muted-foreground opacity-80" aria-hidden/>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={8} className="min-w-56 p-1.5 sm:min-w-60">
              <div className="flex items-start gap-3 rounded-lg border border-transparent px-2 py-2.5 sm:px-2.5">
                <Avatar size="default" className="ring-1 ring-black/5 dark:ring-white/10">
                  {profile.avatar_url ? (<AvatarImage src={profile.avatar_url} alt=""/>) : null}
                  <AvatarFallback className={cn("text-xs font-semibold text-white", isSuperAdmin
            ? "bg-linear-to-br from-rose-600 to-rose-900"
            : isPm
                ? "bg-navy text-white"
                : "bg-slate-800")}>
                    {getInitials(profile.full_name)}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0 flex-1 space-y-2">
                  <p className="truncate font-semibold leading-none text-foreground">
                    {profile.full_name}
                  </p>
                  <RoleBadge role={profile.role} className={isSuperAdmin
            ? "border-rose-200 bg-rose-50 text-rose-800 dark:border-rose-400/30 dark:bg-rose-500/15 dark:text-rose-100"
            : undefined}/>
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
