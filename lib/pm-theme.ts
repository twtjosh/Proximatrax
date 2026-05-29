import type { ProjectStatus, TaskPriority } from "@/types/enums";
export const PM_PROJECT_STATUS_CHIP: Record<ProjectStatus, string> = {
    pending_invites: "bg-amber-100 text-amber-900 ring-amber-200/80",
    planning: "bg-slate-100 text-slate-700 ring-slate-200/90",
    in_progress: "bg-copper-soft text-copper ring-copper/30",
    on_hold: "bg-slate-100 text-slate-600 ring-slate-200/90",
    completed: "bg-success-soft text-emerald-800 ring-emerald-200/70",
};
export const PM_PROJECT_STATUS_DOT: Record<ProjectStatus, string> = {
    pending_invites: "bg-amber-500",
    planning: "bg-slate-400",
    in_progress: "bg-copper",
    on_hold: "bg-slate-500",
    completed: "bg-success",
};
export const PM_PROJECT_STATUS_RAIL: Record<ProjectStatus, string> = {
    pending_invites: "border-l-amber-500",
    planning: "border-l-slate-400",
    in_progress: "border-l-copper",
    on_hold: "border-l-slate-500",
    completed: "border-l-emerald-500",
};
export function pmPriorityBadgeClass(priority: TaskPriority): string {
    switch (priority) {
        case "high":
            return "border-error/20 bg-error-soft text-error";
        case "medium":
            return "border-copper/25 bg-copper-soft text-copper-hover";
        default:
            return "border-cool-grey bg-surface-spotlight text-muted-ink";
    }
}
export const PM_MILESTONE_BADGE = "border-copper/20 bg-copper-soft text-copper-hover";
export const PM_SURFACE_STATIC = "cursor-default select-none border-slate-200/80 bg-white/80";
export const PM_BTN_FILLED = "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full bg-navy px-4 text-sm font-semibold text-white shadow-[0_2px_8px_-2px_rgba(15,23,42,0.35)] ring-1 ring-navy-deep/20 transition-all duration-200 hover:bg-copper hover:shadow-[0_4px_14px_-2px_rgba(217,119,6,0.45)] hover:ring-copper/30 active:scale-[0.98]";
export const PM_BTN_OUTLINE = "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full border-2 border-slate-200 bg-white px-4 text-sm font-semibold text-charcoal shadow-sm transition-all duration-200 hover:border-copper/50 hover:bg-copper-soft/30 hover:text-copper-hover active:scale-[0.98]";
export const PM_LINK_ACTION = "inline-flex cursor-pointer items-center gap-1.5 rounded-full px-3 py-1.5 text-sm font-semibold text-copper transition-colors hover:bg-copper-soft/50 hover:text-copper-hover";
export const PM_CARD_CLICKABLE = "group cursor-pointer border-2 border-slate-200/90 bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.1)] transition-all duration-250 ease-out hover:-translate-y-0.5 hover:border-copper/45 hover:shadow-[0_12px_32px_-10px_rgba(217,119,6,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:ring-offset-2";
export const PM_CARD_HOVER = PM_CARD_CLICKABLE;
export const PM_ROW_CLICKABLE = "group cursor-pointer rounded-xl border-2 border-transparent bg-white transition-all duration-200 hover:border-copper/30 hover:bg-copper-soft/20 hover:shadow-[0_4px_16px_-8px_rgba(217,119,6,0.15)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/35";
export const PM_ROW_HOVER = PM_ROW_CLICKABLE;
export const PM_ACTION_ORB = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-slate-200 bg-slate-50 text-slate-400 transition-all duration-200 group-hover:border-copper/40 group-hover:bg-copper group-hover:text-white group-hover:shadow-[0_2px_8px_rgba(217,119,6,0.35)]";
export const PM_OVERDUE_ROW = "bg-amber-50/80 border-amber-200/60";
export const PM_OVERDUE_TEXT = "text-amber-800";
export const PM_OVERDUE_ICON = "bg-amber-100 text-amber-700 ring-1 ring-amber-200/80";
export const PM_ICON_HOVER = "transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-copper";
export const PM_BTN_NAVY_HOVER = "transition-all duration-200 ease-out hover:bg-copper hover:shadow-[0_4px_16px_-2px_rgba(217,119,6,0.35)] active:scale-[0.98]";
export const PM_SIDEBAR_LINK_HOVER = "cursor-pointer rounded-xl text-slate-300 transition-all duration-150 hover:bg-white/8 hover:text-white hover:ring-1 hover:ring-white/10";
export const PM_SIDEBAR_LINK_ACTIVE = "cursor-pointer rounded-xl bg-white/12 font-semibold text-white shadow-[inset_3px_0_0_0_var(--copper)] ring-1 ring-white/10";
