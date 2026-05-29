"use client";
import { cn } from "@/lib/utils";
export type HeaderVisualTier = "minimal" | "tight" | "balanced" | "roomy";
export function headerVisualTierFromHeight(headerHeightPx: number): HeaderVisualTier {
    if (headerHeightPx < 215)
        return "minimal";
    if (headerHeightPx < 285)
        return "tight";
    if (headerHeightPx < 365)
        return "balanced";
    return "roomy";
}
type ProjectHeaderPaneProps = {
    headerHeightPx: number;
    isResizing: boolean;
    children: React.ReactNode;
};
export function ProjectHeaderPane({ headerHeightPx, isResizing, children, }: ProjectHeaderPaneProps) {
    const tier = headerVisualTierFromHeight(headerHeightPx);
    return (<div data-tier={tier} data-header-height={headerHeightPx} className={cn("min-h-0 flex-1 overflow-hidden", "transition-[padding] duration-150 ease-out", tier === "minimal" && "py-1", tier === "tight" && "py-1.5", tier === "balanced" && "py-2.5", tier === "roomy" && "py-3.5", isResizing && "pointer-events-none")}>
      <div className={cn("header-pane-inner mx-auto flex h-full min-h-0 w-full max-w-[1600px] flex-col justify-center px-4 sm:px-5 lg:px-6", tier === "minimal" && [
            "[&_.header-back-link]:text-[11px]",
            "[&_.header-meta-row]:!mt-1.5 [&_.header-meta-row]:!flex-row [&_.header-meta-row]:!items-center [&_.header-meta-row]:!justify-between [&_.header-meta-row]:!gap-2",
            "[&_.header-primary]:!min-w-0 [&_.header-primary]:!flex-1 [&_.header-primary]:!space-y-0",
            "[&_.header-kicker]:hidden",
            "[&_.header-description]:hidden",
            "[&_.header-meta-details]:hidden",
            "[&_.header-title]:!text-base [&_.header-title]:sm:!text-lg",
            "[&_.header-progress-card]:!w-auto [&_.header-progress-card]:!max-w-[11rem] [&_.header-progress-card]:!shrink-0 [&_.header-progress-card]:!gap-1.5 [&_.header-progress-card]:!p-2",
            "[&_.header-progress-detail]:hidden",
            "[&_.header-progress-roster-row]:!hidden",
            "[&_.header-roster]:hidden",
            "[&_.header-quick-actions]:hidden",
            "[&_.header-progress-pct]:!text-lg",
        ], tier === "tight" && [
            "[&_.header-back-link]:text-[11px]",
            "[&_.header-meta-row]:!mt-2 [&_.header-meta-row]:!flex-col [&_.header-meta-row]:!items-stretch [&_.header-meta-row]:!gap-2",
            "[&_.header-primary]:!space-y-1.5",
            "[&_.header-kicker]:text-[9px]",
            "[&_.header-description]:line-clamp-1 [&_.header-description]:!text-xs",
            "[&_.header-meta-details]:text-[11px]",
            "[&_.header-title]:!text-lg [&_.header-title]:sm:!text-xl",
            "[&_.header-progress-card]:!w-full [&_.header-progress-card]:!max-w-none [&_.header-progress-card]:!p-2.5 [&_.header-progress-card]:!gap-2",
            "[&_.header-progress-pct]:!text-xl",
            "[&_.header-roster]:hidden",
            "[&_.header-quick-actions]:!grid [&_.header-quick-actions]:!w-full [&_.header-quick-actions]:!grid-cols-3 [&_.header-quick-actions]:!gap-1",
            "[&_.header-quick-actions>*]:!h-7 [&_.header-quick-actions>*]:!min-h-0 [&_.header-quick-actions>*]:!px-1.5",
        ], tier === "balanced" && [
            "[&_.header-meta-row]:!mt-3 [&_.header-meta-row]:gap-4",
            "[&_.header-description]:line-clamp-2",
            "[&_.header-title]:!text-xl [&_.header-title]:sm:!text-2xl",
            "[&_.header-progress-card]:!p-3",
            "[&_.header-roster]:hidden lg:flex",
        ], tier === "roomy" && [
            "[&_.header-meta-row]:!mt-4 [&_.header-meta-row]:gap-5",
            "[&_.header-description]:line-clamp-none",
        ])}>
        {children}
      </div>
    </div>);
}
