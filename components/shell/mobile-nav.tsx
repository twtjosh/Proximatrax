"use client";
import type * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { CircleUserRound, MessageCircle, Search } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { useMessenger } from "@/components/messenger/messenger-store";
import { AccountMenu } from "@/components/shell/account-menu";
import { BrandMark } from "@/components/shell/brand-mark";
import { NotificationsMenu, type NotificationsState } from "@/components/shell/notifications-menu";
import { ROUTES } from "@/lib/constants";
import { accountPathFor, isNavItemActive, type NavItem } from "@/lib/navigation";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";
import type { Profile } from "@/types/database";

type MobileTopBarProps = {
    profile: Profile;
    navItems: NavItem[];
    onOpenSearch: (() => void) | null;
    notifications: NotificationsState | null;
    homeHref: string;
};

/** Phone and tablet header: where am I, plus search, notifications and account. */
export function MobileTopBar({ profile, navItems, onOpenSearch, notifications, homeHref }: MobileTopBarProps) {
    const pathname = usePathname();
    const section = navItems.find((item) => isNavItemActive(item, pathname))?.label ?? "ProximaTrax";
    return (<header className="flex h-14 shrink-0 items-center gap-3 bg-rail px-3 text-rail-ink sm:px-4 lg:hidden">
      <Link href={homeHref} aria-label="ProximaTrax home" className="rounded-md outline-none focus-visible:ring-2 focus-visible:ring-brand-bright/60">
        <BrandMark className="size-7"/>
      </Link>
      <p className="min-w-0 flex-1 truncate text-[15px] font-semibold">{section}</p>
      <div className="flex shrink-0 items-center gap-0.5">
        {onOpenSearch ? (<button type="button" onClick={onOpenSearch} aria-label="Search projects" className="inline-flex size-9 cursor-pointer items-center justify-center rounded-md text-rail-ink-secondary outline-none hover:bg-rail-raised hover:text-rail-ink focus-visible:ring-2 focus-visible:ring-brand-bright/60">
            <Search className="size-4" aria-hidden/>
          </button>) : null}
        {notifications ? <NotificationsMenu {...notifications} appearance="icon"/> : null}
        <AccountMenu profile={profile} appearance="icon"/>
      </div>
    </header>);
}

type MobileTabBarProps = {
    navItems: NavItem[];
    badges: Partial<Record<NonNullable<NavItem["badge"]>, number>>;
};

/** Primary destinations within thumb reach. Hidden once the sidebar appears. */
export function MobileTabBar({ navItems, badges }: MobileTabBarProps) {
    const pathname = usePathname();
    return (<nav aria-label="Primary" className="shrink-0 border-t border-line bg-surface pb-[env(safe-area-inset-bottom)] lg:hidden">
      <ul className="mx-auto flex h-14 max-w-md">
        {navItems.map((item) => {
            const Icon = item.icon;
            const active = isNavItemActive(item, pathname);
            const count = item.badge ? badges[item.badge] ?? 0 : 0;
            return (<li key={item.href} className="flex-1">
              <Link href={item.href} aria-current={active ? "page" : undefined} className={cn("relative flex h-full flex-col items-center justify-center gap-1 text-xs outline-none focus-visible:bg-surface-sunken", active ? "font-medium text-ink" : "text-ink-tertiary")}>
                {active ? <motion.span layoutId="tab-active" transition={SPRING} className="absolute inset-x-6 top-0 h-0.5 rounded-b-full bg-brand" aria-hidden/> : null}
                <span className="relative">
                  <Icon className={cn("size-5 transition-colors duration-300 ease-spring", active && "text-brand")} strokeWidth={active ? 2 : 1.75} aria-hidden/>
                  {count > 0 ? (<span className="absolute -top-1 -right-1.5 size-2 rounded-full bg-brand ring-2 ring-surface" aria-hidden/>) : null}
                </span>
                {item.label}
                {count > 0 ? <span className="sr-only">, {count} unread</span> : null}
              </Link>
            </li>);
        })}
      </ul>
    </nav>);
}

/**
 * Room the dock takes over the page foot: exactly its height (0.75rem off the
 * edge, a 60px pill). Sticky footers stop at the scroll area's padding, so
 * they land right on top of the dock with no strip of page showing between.
 */
export const DOCK_CLEARANCE = "max-lg:pb-[calc(env(safe-area-inset-bottom)+4.5rem)]";

const dockIcon = cn("press relative grid size-12 cursor-pointer place-items-center rounded-full text-ink-secondary transition-colors duration-300 hover:text-ink", focusRing);

/** One stop on the dock: an icon, or, where the viewer is, an ink pill that names it. */
function DockLink({ href, label, spoken = label, active, children }: {
    href: string;
    label: string;
    /** What a screen reader hears when the stop is an icon, if more than the label (an unread count). */
    spoken?: string;
    active: boolean;
    children: React.ReactNode;
}) {
    return (<motion.li layout transition={SPRING}>
      <Link href={href} aria-current={active ? "page" : undefined} aria-label={active ? undefined : spoken} className={active ? cn("relative isolate flex h-12 items-center gap-2 rounded-full pr-5 pl-3.5 text-[15px] font-semibold text-white", focusRing) : dockIcon}>
        {active ? <motion.span layoutId="dock-active" transition={SPRING} className="absolute inset-0 -z-10 rounded-full bg-ink" aria-hidden/> : null}
        {children}
        {active ? label : null}
      </Link>
    </motion.li>);
}

/**
 * Clients and crew get a floating dock in place of the top and tab bars:
 * their places, Messages (its own screen here, in place of the messenger's
 * bubble and panel) and Profile. Four stops, so it never scrolls. Hidden
 * once the sidebar appears.
 */
export function MobileDock({ navItems, profile }: {
    navItems: NavItem[];
    profile: Profile;
}) {
    const pathname = usePathname();
    const unread = useMessenger((s) => Object.values(s.unread ?? {}).reduce((sum, n) => sum + n, 0));
    const profileHref = accountPathFor(profile.role) ?? ROUTES.ACCOUNT;
    return (<nav aria-label="Primary" className="pointer-events-none fixed inset-x-0 bottom-[calc(env(safe-area-inset-bottom)+0.75rem)] z-30 flex justify-center px-4 lg:hidden">
      <ul className="pointer-events-auto flex items-center gap-1 rounded-full bg-surface/90 p-1.5 shadow-[0_1px_2px_rgb(14_18_34/0.08),0_20px_40px_-16px_rgb(14_18_34/0.4)] ring-1 ring-line/70 backdrop-blur-xl backdrop-saturate-150">
        {navItems.map((item) => {
            const Icon = item.icon;
            return (<DockLink key={item.href} href={item.href} label={item.label} active={isNavItemActive(item, pathname)}>
              <Icon className="size-5.5 shrink-0" strokeWidth={1.9} aria-hidden/>
            </DockLink>);
        })}
        <DockLink href={ROUTES.MESSAGES} label="Messages" spoken={unread > 0 ? `Messages, ${unread} unread` : "Messages"} active={pathname === ROUTES.MESSAGES}>
          <span className="relative grid shrink-0 place-items-center">
            <MessageCircle className="size-5.5" strokeWidth={1.9} aria-hidden/>
            {unread > 0 ? <span aria-hidden className="absolute -top-0.5 -right-0.5 size-2.5 rounded-full bg-copper ring-2 ring-surface"/> : null}
          </span>
        </DockLink>
        <DockLink href={profileHref} label="Profile" active={pathname === profileHref}>
          <CircleUserRound className="size-5.5 shrink-0" strokeWidth={1.9} aria-hidden/>
        </DockLink>
      </ul>
    </nav>);
}
