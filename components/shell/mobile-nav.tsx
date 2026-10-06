"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { Search } from "lucide-react";
import { AccountMenu } from "@/components/shell/account-menu";
import { BrandMark } from "@/components/shell/brand-mark";
import { NotificationsMenu, type NotificationsState } from "@/components/shell/notifications-menu";
import { isNavItemActive, type NavItem } from "@/lib/navigation";
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
