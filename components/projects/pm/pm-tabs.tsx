"use client";
import Link from "next/link";
import { motion } from "framer-motion";
import { focusRing } from "@/components/dashboard/overview-kit";
import type { ProjectWorkspaceTab } from "@/lib/project-view-policy";
import { SPRING } from "@/lib/motion";
import { cn } from "@/lib/utils";

/** Which tab a path belongs to; Overview only matches exactly. */
export function activeTabIndex(pathname: string, tabs: ProjectWorkspaceTab[]): number {
    return tabs.findIndex((t) => (t.exact ? pathname === t.href : pathname === t.href || pathname.startsWith(`${t.href}/`)));
}

/** Underline tabs; the copper line slides to the chosen tab. Review carries its waiting count. */
export function PmTabs({ tabs, active, reviewCount }: {
    tabs: ProjectWorkspaceTab[];
    active: number;
    reviewCount: number;
}) {
    return (<nav aria-label="Project" className="-mb-px flex gap-1 overflow-x-auto [scrollbar-width:none]">
      {tabs.map((tab, i) => {
            const isActive = i === active;
            const showCount = tab.label === "Review" && reviewCount > 0;
            return (<Link key={tab.href} href={tab.href} aria-current={isActive ? "page" : undefined} className={cn("relative inline-flex shrink-0 items-center gap-1.5 rounded-t-lg px-3 py-3 text-sm font-medium transition-colors duration-300 ease-spring", isActive ? "text-ink" : "text-ink-tertiary hover:text-ink", focusRing, "focus-visible:ring-offset-0")}>
            {tab.label}
            {showCount ? <span className="rounded-full bg-warning-soft px-1.5 text-[11px] font-semibold text-warning tabular" aria-label={`${reviewCount} waiting`}>{reviewCount}</span> : null}
            {isActive ? <motion.span layoutId="pm-tab-line" transition={SPRING} className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-copper" aria-hidden/> : null}
          </Link>);
        })}
    </nav>);
}
