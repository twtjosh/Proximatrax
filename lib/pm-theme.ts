import type { ProjectStatus } from "@/types/enums";
export const PM_PROJECT_STATUS_CHIP: Record<ProjectStatus, string> = {
    pending_invites: "bg-amber-100 text-amber-900 ring-amber-200/80",
    planning: "bg-slate-100 text-slate-700 ring-slate-200/90",
    in_progress: "bg-copper-soft text-copper ring-copper/30",
    on_hold: "bg-slate-100 text-slate-600 ring-slate-200/90",
    completed: "bg-success-soft text-emerald-800 ring-emerald-200/70",
};
export const PM_CARD_CLICKABLE = "group cursor-pointer border-2 border-slate-200/90 bg-white shadow-[0_2px_12px_-6px_rgba(15,23,42,0.1)] transition-all duration-250 ease-out hover:-translate-y-0.5 hover:border-copper/45 hover:shadow-[0_12px_32px_-10px_rgba(217,119,6,0.22)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-copper/40 focus-visible:ring-offset-2";
export const PM_CARD_HOVER = PM_CARD_CLICKABLE;
export const PM_ICON_HOVER = "transition-all duration-200 group-hover:translate-x-0.5 group-hover:text-copper";
