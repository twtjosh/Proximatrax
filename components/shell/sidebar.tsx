"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { PanelLeftClose, PanelLeftOpen, Search } from "lucide-react";
import { AccountMenu } from "@/components/shell/account-menu";
import { BrandLockup, BrandMark } from "@/components/shell/brand-mark";
import { NotificationsMenu, type NotificationsState } from "@/components/shell/notifications-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { projectPath, ROUTES } from "@/lib/constants";
import { isNavItemActive, type NavItem } from "@/lib/navigation";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type SidebarProps = {
    profile: Profile;
    navItems: NavItem[];
    badges: Partial<Record<NonNullable<NavItem["badge"]>, number>>;
    collapsed: boolean;
    onToggleCollapsed: () => void;
    onOpenSearch: (() => void) | null;
    shortcutLabel: string;
    notifications: NotificationsState | null;
    homeHref: string;
    /** Active projects to list under Projects; null while loading or not applicable. */
    projects: RailProject[] | null;
};

export type RailProject = {
    id: string;
    title: string;
};

/** Projects listed under the Projects destination before the list stops. */
const RAIL_PROJECTS = 6;

/** A tooltip naming a control; always shown for icon-only controls. */
function RailTooltip({ label, show, children }: {
    label: string;
    show: boolean;
    children: React.ReactElement;
}) {
    if (!show)
        return children;
    return (<Tooltip>
      <TooltipTrigger render={children}/>
      <TooltipContent side="right" sideOffset={10}>{label}</TooltipContent>
    </Tooltip>);
}

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand-bright/60";
const iconButton = cn("inline-flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-md text-rail-ink-secondary transition-colors hover:bg-rail-raised hover:text-rail-ink", focusRing);

/**
 * Desktop navigation rail in midnight, so the bright workspace beside it reads
 * as the working surface (on the Night overview, a hairline keeps them apart). Under Projects it lists the active projects, so a
 * project is one click from anywhere. Destinations come from the role, never
 * from this component.
 */
export function Sidebar({ navItems, badges, collapsed, onToggleCollapsed, onOpenSearch, shortcutLabel, notifications, homeHref, projects, profile }: SidebarProps) {
    const pathname = usePathname();
    const collapseLabel = collapsed ? "Expand sidebar" : "Collapse sidebar";
    const collapseButton = (<RailTooltip label={collapseLabel} show>
        <button type="button" onClick={onToggleCollapsed} aria-label={collapseLabel} className={iconButton}>
          {collapsed ? <PanelLeftOpen className="size-4" aria-hidden/> : <PanelLeftClose className="size-4" aria-hidden/>}
        </button>
      </RailTooltip>);

    return (<aside aria-label="Workspace" className={cn("hidden shrink-0 flex-col border-r border-rail-line bg-rail text-rail-ink transition-[width] duration-[450ms] ease-spring motion-reduce:transition-none lg:flex", collapsed ? "w-16" : "w-62")}>
      <div className={cn("flex h-16 shrink-0 items-center gap-2", collapsed ? "justify-center" : "pr-2 pl-4")}>
        <Link href={homeHref} aria-label="ProximaTrax home" className={cn("min-w-0 flex-1 rounded-md", collapsed && "flex-none", focusRing)}>
          {collapsed ? <BrandMark className="size-7"/> : <BrandLockup />}
        </Link>
        {collapsed ? null : collapseButton}
      </div>

      <div className={cn("flex gap-2 pb-4", collapsed ? "flex-col items-center px-3.5" : "px-3")}>
        {onOpenSearch ? (collapsed ? (<RailTooltip label={`Search projects (${shortcutLabel})`} show>
              <button type="button" onClick={onOpenSearch} aria-label="Search projects" className={iconButton}>
                <Search className="size-4" aria-hidden/>
              </button>
            </RailTooltip>) : (<button type="button" onClick={onOpenSearch} className={cn("flex h-9 min-w-0 flex-1 cursor-pointer items-center gap-2.5 rounded-md border border-rail-line bg-rail-raised/60 px-2.5 text-sm text-rail-ink-tertiary transition-colors hover:border-rail-ink-tertiary/50 hover:text-rail-ink-secondary", focusRing)}>
              <Search className="size-4 shrink-0" aria-hidden/>
              <span className="flex-1 truncate text-left">Search</span>
              <kbd className="rounded-sm border border-rail-line px-1 font-mono text-[11px] text-rail-ink-tertiary">{shortcutLabel}</kbd>
            </button>)) : null}
      </div>

      <nav aria-label="Primary" className={cn("flex-1 overflow-y-auto", collapsed ? "px-3.5" : "px-3")}>
        <ul className="flex flex-col gap-0.5">
          {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, pathname);
            const count = item.badge ? badges[item.badge] ?? 0 : 0;
            return (<li key={item.href}>
                <RailTooltip label={count > 0 ? `${item.label} (${count})` : item.label} show={collapsed}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} aria-label={collapsed ? item.label : undefined} className={cn("relative isolate flex h-9 items-center gap-3 rounded-md text-sm transition-colors duration-300 ease-spring", focusRing, collapsed ? "w-9 justify-center" : "px-2.5", active
                    ? "font-medium text-rail-ink"
                    : "text-rail-ink-secondary hover:bg-rail-raised/60 hover:text-rail-ink")}>
                    {/* The highlight and its copper rule travel to the page you open. */}
                    {active ? (<>
                        <motion.span layoutId="rail-active" transition={SPRING} className="absolute inset-0 -z-10 rounded-md bg-rail-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]" aria-hidden/>
                        <motion.span layoutId="rail-active-rule" transition={SPRING} className={cn("absolute top-2 bottom-2 w-0.5 rounded-full bg-brand-bright", collapsed ? "-left-3.5" : "-left-3")} aria-hidden/>
                      </>) : null}
                    <Icon className={cn("size-4 shrink-0 transition-colors duration-300 ease-spring", active ? "text-brand-bright" : "text-rail-ink-tertiary")} aria-hidden/>
                    {collapsed ? null : <span className="min-w-0 flex-1 truncate">{item.label}</span>}
                    {count > 0 ? (collapsed ? (<span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-bright ring-2 ring-rail" aria-hidden/>) : (<span className="rounded-sm bg-brand px-1.5 font-mono text-[11px] leading-5 font-medium text-white">
                          {count > 99 ? "99+" : count}
                        </span>)) : null}
                  </Link>
                </RailTooltip>
                {item.href === ROUTES.PROJECTS && !collapsed && projects && projects.length > 0 ? (<ul aria-label="Active projects" className="mt-0.5 mb-1.5 ml-[1.0625rem] flex flex-col border-l border-rail-line pl-2">
                    {projects.slice(0, RAIL_PROJECTS).map((p) => {
                    const here = pathname === projectPath(p.id) || pathname.startsWith(`${projectPath(p.id)}/`);
                    return (<li key={p.id}>
                        <Link href={projectPath(p.id)} aria-current={here ? "page" : undefined} className={cn("relative flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors hover:bg-rail-raised/60", focusRing, here ? "font-medium text-rail-ink before:absolute before:top-2 before:bottom-2 before:-left-[9px] before:w-0.5 before:rounded-full before:bg-brand-bright" : "text-rail-ink-secondary hover:text-rail-ink")}>
                          <span className="truncate">{p.title}</span>
                        </Link>
                      </li>);
                })}
                    {projects.length > RAIL_PROJECTS ? (<li>
                        <Link href={ROUTES.PROJECTS} className={cn("flex h-8 items-center rounded-md px-2.5 text-[13px] text-rail-ink-tertiary transition-colors hover:bg-rail-raised/60 hover:text-rail-ink", focusRing)}>
                          {projects.length - RAIL_PROJECTS} more
                        </Link>
                      </li>) : null}
                  </ul>) : null}
              </li>);
        })}
        </ul>
      </nav>

      <div className={cn("flex shrink-0 flex-col gap-1 border-t border-rail-line py-3", collapsed ? "items-center px-3.5" : "px-3")}>
        {notifications ? (<NotificationsMenu {...notifications} appearance={collapsed ? "icon" : "row"} side="right"/>) : null}
        <AccountMenu profile={profile} appearance={collapsed ? "icon" : "row"} side="right"/>
        {collapsed ? collapseButton : null}
      </div>
    </aside>);
}
