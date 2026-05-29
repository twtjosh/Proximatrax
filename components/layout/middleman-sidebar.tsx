"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { Building2, ChevronLeft, ChevronRight, LayoutGrid, UserCircle, } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ROLE_LABELS, ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import { useSidebarStore } from "@/store/use-sidebar-store";
import type { Profile } from "@/types/database";
type NavItem = {
    href: string;
    label: string;
    icon: typeof LayoutGrid;
};
const navigationItems: NavItem[] = [
    {
        href: ROUTES.MIDDLEMAN_HOME,
        label: "Field home",
        icon: LayoutGrid,
    },
    {
        href: ROUTES.PROJECTS,
        label: "My projects",
        icon: Building2,
    },
    {
        href: ROUTES.MIDDLEMAN_ACCOUNT,
        label: "Account",
        icon: UserCircle,
    },
];
type MiddlemanSidebarProps = {
    profile: Profile;
};
export function MiddlemanSidebar({ profile }: MiddlemanSidebarProps) {
    const pathname = usePathname();
    const { isCollapsed, toggleSidebar } = useSidebarStore();
    return (<aside className={cn("sticky top-0 hidden h-svh max-h-svh w-60 shrink-0 flex-col overflow-y-auto border-r border-border bg-background transition-[width] duration-200 md:flex", isCollapsed && "w-16")}>
      <div className={cn("flex shrink-0 border-b border-border", isCollapsed
            ? "flex-col items-center gap-2 px-2 py-3"
            : "h-14 flex-row items-center justify-between gap-2 px-3")}>
        <Link href={ROUTES.MIDDLEMAN_HOME} className={cn("flex items-center gap-2.5 rounded-md py-1.5 outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring", isCollapsed ? "justify-center" : "min-w-0 flex-1")}>
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border bg-muted text-muted-foreground">
            <Building2 className="h-4 w-4" aria-hidden/>
          </div>
          {!isCollapsed ? (<div className="min-w-0">
              <span className="block truncate font-heading text-base font-semibold tracking-tight text-foreground">
                ProximaTrax
              </span>
              <span className="block truncate font-mono text-[9px] font-medium uppercase tracking-[0.16em] text-[#d97706]">
                Field workspace
              </span>
            </div>) : null}
        </Link>

        <Button type="button" size="icon-sm" variant="ghost" onClick={toggleSidebar} className="shrink-0 text-muted-foreground hover:bg-muted hover:text-foreground" aria-label={isCollapsed ? "Expand sidebar" : "Collapse sidebar"}>
          {isCollapsed ? (<ChevronRight className="h-4 w-4"/>) : (<ChevronLeft className="h-4 w-4"/>)}
        </Button>
      </div>

      <nav className="flex-1 space-y-0.5 p-2" aria-label="Middleman primary">
        {navigationItems.map((item) => {
            const Icon = item.icon;
            const isActive = pathname === item.href ||
                (item.href === ROUTES.PROJECTS &&
                    (pathname === ROUTES.PROJECTS ||
                        pathname.startsWith(`${ROUTES.PROJECTS}/`)));
            return (<Link key={item.href} href={item.href} className={cn("relative flex items-center gap-3 rounded-md px-3 py-2 text-sm outline-none transition-colors", isActive
                    ? "bg-muted font-medium text-foreground"
                    : "text-muted-foreground hover:bg-muted/70 hover:text-foreground", isCollapsed && "justify-center px-2")} title={isCollapsed ? item.label : undefined}>
              <Icon className="h-4 w-4 shrink-0" aria-hidden/>
              {!isCollapsed ? (<span className="min-w-0 flex-1 truncate">{item.label}</span>) : null}
            </Link>);
        })}
      </nav>

      <div className="shrink-0 border-t border-border p-2">
        <div className={cn("flex items-center gap-3 rounded-md border border-border bg-muted/40 px-2.5 py-2", isCollapsed && "justify-center border-0 bg-transparent px-0")}>
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-foreground text-xs font-semibold text-background">
            {profile.full_name
            .split(" ")
            .map((part) => part[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
          </div>
          {!isCollapsed ? (<div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-foreground">
                {profile.full_name}
              </p>
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {ROLE_LABELS[profile.role]}
              </p>
            </div>) : null}
        </div>
      </div>
    </aside>);
}
