"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, LayoutDashboard, Sparkles, UserCircle, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import type { Profile } from "@/types/database";
const navigationItems = [
    { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
    { href: ROUTES.PROJECTS, label: "Your projects", icon: Building2 },
    { href: ROUTES.ACCOUNT, label: "Account", icon: UserCircle },
] as const;
type ClientSidebarProps = {
    profile: Profile;
};
export function ClientSidebar({ profile }: ClientSidebarProps) {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebarStore();
    return (<aside className={cn("sticky top-0 hidden h-svh max-h-svh shrink-0 flex-col overflow-y-auto border-r border-stone-200/90 bg-[#fafaf9] transition-[width] duration-200 md:flex", isCollapsed ? "w-[4.25rem]" : "w-[17rem]")}>
      <div className={cn("flex shrink-0 border-b border-stone-200/80", isCollapsed
            ? "flex-col items-center gap-2 px-2 py-3"
            : "h-[3.75rem] flex-row items-center justify-between gap-2 px-3")}>
        <Link href={ROUTES.DASHBOARD} className={cn("flex items-center gap-2.5 rounded-xl py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-amber-600/30 focus-visible:ring-offset-2 focus-visible:ring-offset-[#fafaf9]", isCollapsed ? "justify-center" : "min-w-0 flex-1")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-stone-900 text-[10px] font-semibold tracking-tight text-white shadow-sm">
            PT
          </div>
          {!isCollapsed ? (<div className="min-w-0 flex-1">
              <span className="block truncate font-heading text-[15px] font-semibold tracking-tight text-stone-900">
                ProximaTrax
              </span>
              <span className="mt-0.5 flex items-center gap-1 truncate text-[11px] font-medium text-stone-500">
                <Sparkles className="h-3 w-3 shrink-0 text-amber-600/90" aria-hidden/>
                Client portal
              </span>
            </div>) : null}
        </Link>

        <Button type="button" size="icon-sm" variant="ghost" onClick={toggleSidebar} className="shrink-0 text-stone-500 hover:bg-stone-200/60 hover:text-stone-900" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? (<ChevronRight className="h-4 w-4"/>) : (<ChevronLeft className="h-4 w-4"/>)}
        </Button>
      </div>

      <nav className="flex-1 space-y-1 p-2.5" aria-label="Client portal">
        {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
                (item.href === ROUTES.PROJECTS && pathname.startsWith(`${ROUTES.PROJECTS}/`));
            return (<Link key={item.href} href={item.href} className={cn("relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-[13px] outline-none transition-all", isActive
                    ? "bg-white font-medium text-stone-900 shadow-sm ring-1 ring-stone-200/90"
                    : "text-stone-600 hover:bg-stone-200/40 hover:text-stone-900", isCollapsed && "justify-center px-2")} title={isCollapsed ? item.label : undefined}>
              <Icon className={cn("h-[18px] w-[18px] shrink-0", isActive ? "text-amber-700" : "text-stone-400")} aria-hidden/>
              {!isCollapsed ? <span className="min-w-0 flex-1 truncate">{item.label}</span> : null}
            </Link>);
        })}
      </nav>

      <div className="shrink-0 border-t border-stone-200/80 p-2.5">
        <div className={cn("flex items-center gap-3 rounded-xl border border-stone-200/80 bg-white/80 px-2.5 py-2.5 shadow-[0_1px_0_rgba(28,25,23,0.04)]", isCollapsed && "justify-center border-0 bg-transparent px-0 shadow-none")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-gradient-to-br from-stone-800 to-stone-950 text-[11px] font-semibold text-white">
            {profile.full_name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          </div>
          {!isCollapsed ? (<div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-stone-900">{profile.full_name}</p>
              <p className="truncate text-xs text-stone-500">Signed in</p>
            </div>) : null}
        </div>
      </div>
    </aside>);
}
