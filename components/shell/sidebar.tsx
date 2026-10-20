"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { AccountMenu } from "@/components/shell/account-menu";
import { BrandLockup } from "@/components/shell/brand-mark";
import { NotificationsMenu, type NotificationsState } from "@/components/shell/notifications-menu";
import { RAIL_DOT, RAIL_MOTION, RAIL_TEXT } from "@/components/shell/rail";
import { projectPath, ROUTES } from "@/lib/constants";
import { isNavItemActive, type NavItem } from "@/lib/navigation";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type SidebarProps = {
    profile: Profile;
    navItems: NavItem[];
    badges: Partial<Record<NonNullable<NavItem["badge"]>, number>>;
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

const focusRing = "outline-none focus-visible:ring-2 focus-visible:ring-brand-bright/60";
/**
 * Every row puts its icon at the same spot, the centre of the narrow rail
 * (12px gutter + 12px padding), so opening only reveals text: nothing jumps.
 */
const row = cn("relative isolate flex h-9 w-full items-center gap-3 rounded-md px-3 text-sm", focusRing);

/**
 * Desktop navigation rail in midnight, so the bright workspace beside it reads
 * as the working surface. It rests as a strip of icons and opens over the page
 * on hover (after a beat, so passing the cursor across doesn't flash it), on
 * keyboard focus, and stays open while one of its menus is. The page never
 * reflows: the rail always takes the same 64px. Under Projects it lists the
 * active projects, so a project is one click from anywhere. Destinations come
 * from the role, never from this component.
 */
export function Sidebar({ navItems, badges, onOpenSearch, shortcutLabel, notifications, homeHref, projects, profile }: SidebarProps) {
    const pathname = usePathname();

    return (<aside aria-label="Workspace" data-rail className="relative z-30 hidden w-16 shrink-0 lg:block">
      {/* The shadow slides and fades on its own layer instead of a box-shadow repainting every frame; its edge tracks the rail's. */}
      <div aria-hidden className={cn("pointer-events-none absolute inset-y-0 left-0 w-62 -translate-x-46 opacity-0 shadow-[16px_0_40px_-12px_rgb(0_0_0/0.4)] transition-[translate,opacity] rail-open:translate-x-0 rail-open:opacity-100", RAIL_MOTION)}/>
      <div className={cn("absolute inset-y-0 left-0 flex w-16 flex-col overflow-hidden border-r border-rail-line bg-rail text-rail-ink transition-[width] rail-open:w-62", RAIL_MOTION)}>
        <div className="flex h-16 shrink-0 items-center px-3">
          <Link href={homeHref} aria-label="ProximaTrax home" className={cn("flex min-w-0 flex-1 rounded-md px-1.5 py-1", focusRing)}>
            <BrandLockup />
          </Link>
        </div>

        {onOpenSearch ? (<div className="px-3 pb-4">
            <button type="button" onClick={onOpenSearch} aria-label="Search projects" className={cn(row, "cursor-pointer bg-rail-raised/60 text-rail-ink-tertiary ring-1 ring-rail-line transition-[color,box-shadow] ring-inset hover:text-rail-ink-secondary hover:ring-rail-ink-tertiary/50")}>
              <Search className="size-4 shrink-0" aria-hidden/>
              <span className={cn("flex-1 truncate text-left", RAIL_TEXT)}>Search</span>
              <kbd className={cn("rounded-sm border border-rail-line px-1 font-mono text-[11px] text-rail-ink-tertiary", RAIL_TEXT)}>{shortcutLabel}</kbd>
            </button>
          </div>) : null}

        <nav aria-label="Primary" className="flex-1 overflow-x-hidden overflow-y-auto px-3">
          <ul className="flex flex-col gap-0.5">
            {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, pathname);
            const count = item.badge ? badges[item.badge] ?? 0 : 0;
            return (<li key={item.href}>
                  <Link href={item.href} aria-current={active ? "page" : undefined} className={cn(row, "transition-colors duration-300 ease-spring", active
                    ? "font-medium text-rail-ink"
                    : "text-rail-ink-secondary hover:bg-rail-raised/60 hover:text-rail-ink")}>
                    {/* The highlight and its copper rule travel to the page you open. */}
                    {active ? (<>
                        <motion.span layoutId="rail-active" transition={SPRING} className="absolute inset-0 -z-10 rounded-md bg-rail-raised shadow-[inset_0_1px_0_rgb(255_255_255/0.04)]" aria-hidden/>
                        <motion.span layoutId="rail-active-rule" transition={SPRING} className="absolute top-2 bottom-2 -left-3 w-0.5 rounded-full bg-brand-bright" aria-hidden/>
                      </>) : null}
                    <Icon className={cn("size-4 shrink-0 transition-colors duration-300 ease-spring", active ? "text-brand-bright" : "text-rail-ink-tertiary")} aria-hidden/>
                    <span className={cn("min-w-0 flex-1 truncate", RAIL_TEXT)}>{item.label}</span>
                    {count > 0 ? (<>
                        <span className={cn("rounded-sm bg-brand px-1.5 font-mono text-[11px] leading-5 font-medium text-white", RAIL_TEXT)}>{count > 99 ? "99+" : count}</span>
                        <span className={RAIL_DOT} aria-hidden/>
                      </>) : null}
                  </Link>
                  {item.href === ROUTES.PROJECTS && projects && projects.length > 0 ? (
                // Unfolds with the rail, so the items below glide rather than jump. Tabbing into it opens the rail.
                <div className={cn("grid grid-rows-[0fr] transition-[grid-template-rows] rail-open:grid-rows-[1fr]", RAIL_MOTION)}>
                      <div className="min-h-0 overflow-hidden">
                        <ul aria-label="Active projects" className={cn("mt-0.5 mb-1.5 ml-5 flex flex-col border-l border-rail-line pl-2", RAIL_TEXT)}>
                          {projects.slice(0, RAIL_PROJECTS).map((p) => {
                        const here = pathname === projectPath(p.id) || pathname.startsWith(`${projectPath(p.id)}/`);
                        return (<li key={p.id}>
                                <Link href={projectPath(p.id)} aria-current={here ? "page" : undefined} className={cn("relative flex h-8 items-center rounded-md px-2.5 text-[13px] transition-colors hover:bg-rail-raised/60", focusRing, here ? "font-medium text-rail-ink before:absolute before:top-2 before:bottom-2 before:-left-2.25 before:w-0.5 before:rounded-full before:bg-brand-bright" : "text-rail-ink-secondary hover:text-rail-ink")}>
                                  <span className="truncate">{p.title}</span>
                                </Link>
                              </li>);
                    })}
                          {projects.length > RAIL_PROJECTS ? (<li>
                              <Link href={ROUTES.PROJECTS} className={cn("flex h-8 items-center rounded-md px-2.5 text-[13px] text-rail-ink-tertiary transition-colors hover:bg-rail-raised/60 hover:text-rail-ink", focusRing)}>
                                {projects.length - RAIL_PROJECTS} more
                              </Link>
                            </li>) : null}
                        </ul>
                      </div>
                    </div>) : null}
                </li>);
        })}
          </ul>
        </nav>

        <div className="flex shrink-0 flex-col gap-1 border-t border-rail-line px-3 py-3">
          {notifications ? <NotificationsMenu {...notifications} appearance="row" side="right"/> : null}
          <AccountMenu profile={profile} appearance="row" side="right"/>
        </div>
      </div>
    </aside>);
}
