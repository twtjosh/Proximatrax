"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Bell, ClipboardList, Stamp, Archive } from "lucide-react";
import { NotificationBell } from "@/components/shared/notification-bell";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { useWorkNotifications } from "@/hooks/use-work-notifications";
import type { InquiryTriageRow } from "@/lib/inquiry-triage";
import { cn } from "@/lib/utils";
import { ROUTES } from "@/lib/constants";
type DashboardNotificationBellProps = {
    userId: string;
    inquirySummaries?: InquiryTriageRow[];
    viewedInquiryIds?: string[];
    triggerClassName?: string;
    variant?: "pm" | "middleman" | "client" | "default";
};
function formatWhen(iso: string) {
    const d = new Date(iso);
    const diffMs = Date.now() - d.getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1)
        return "Just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
}
export function DashboardNotificationBell({ userId, inquirySummaries, viewedInquiryIds, triggerClassName, variant = "default", }: DashboardNotificationBellProps) {
    const router = useRouter();
    const { items, unreadCount, markRead, markAllRead } = useWorkNotifications(userId);
    if (inquirySummaries !== undefined) {
        return (<NotificationBell inquirySummaries={inquirySummaries} viewedInquiryIds={viewedInquiryIds} triggerClassName={triggerClassName}/>);
    }
    const preview = items.slice(0, 6);
    const isClient = variant === "client";
    const emptyCopy = isClient
        ? "When a project phase is delivered, you'll see it here."
        : "When assigned work unlocks, you'll see it here.";
    const dashboardHref = isClient ? ROUTES.DASHBOARD : "/dashboard";
    const dashboardLabel = isClient ? "Go to overview" : "Go to dashboard";
    const badge = unreadCount > 0 ? (<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-copper px-1 text-[10px] font-bold leading-none text-white">
        {unreadCount > 99 ? "99+" : unreadCount}
      </span>) : null;
    return (<DropdownMenu>
      <DropdownMenuTrigger type="button" aria-label={unreadCount > 0
            ? `Notifications, ${unreadCount} unread`
            : "Notifications"} className={cn("relative inline-flex size-9 shrink-0 items-center justify-center rounded-xl border text-sm font-medium transition-colors outline-none select-none", "border-slate-200/90 bg-white text-slate-800 hover:bg-slate-50", "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50", "data-popup-open:border-border data-popup-open:bg-muted/80", variant === "middleman" && "rounded-xl", variant === "pm" && "rounded-lg", variant === "client" &&
            "rounded-xl border-stone-200/90 bg-white text-stone-800 hover:bg-stone-50", triggerClassName)}>
        <Bell className="h-4 w-4" aria-hidden/>
        {badge}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-[min(100vw-2rem,22rem)] p-1">
        <div className="flex items-center justify-between gap-2 px-2 py-2">
          <div>
            <p className="text-sm font-medium text-foreground">Notifications</p>
            <p className="text-xs text-muted-foreground">
              {unreadCount > 0
            ? `${unreadCount} waiting for you`
            : "You're all caught up"}
            </p>
          </div>
          {unreadCount > 0 ? (<button type="button" onClick={() => void markAllRead()} className="shrink-0 text-[11px] font-medium text-copper hover:text-copper-hover">
              Mark all read
            </button>) : null}
        </div>

        {preview.length > 0 ? (<>
            {preview.map((row) => {
                const unread = !row.read_at;
                const Icon = row.kind === "project_completed"
                    ? Archive
                    : row.kind === "milestone_delivered"
                        ? Stamp
                        : ClipboardList;
                return (<DropdownMenuItem key={row.id} className={cn("cursor-pointer flex-col items-start gap-1 rounded-md py-2.5 text-left", unread && "bg-copper-soft/25")} onClick={() => {
                        void markRead(row.id);
                        router.push(row.href);
                    }}>
                  <div className="flex w-full items-start gap-2">
                    <Icon className={cn("mt-0.5 h-3.5 w-3.5 shrink-0", unread ? "text-copper" : "text-slate-400")} aria-hidden/>
                    <div className="min-w-0 flex-1">
                      <p className={cn("text-sm leading-snug", unread ? "font-medium text-slate-900" : "text-slate-700")}>
                        {row.title}
                      </p>
                      <p className="mt-0.5 line-clamp-2 text-xs leading-relaxed text-slate-500">
                        {row.body}
                      </p>
                      <p className="mt-1 text-[10px] text-slate-400">
                        {formatWhen(row.created_at)}
                      </p>
                    </div>
                  </div>
                </DropdownMenuItem>);
            })}
            <DropdownMenuSeparator className="my-1"/>
          </>) : (<div className="px-3 py-6 text-center text-sm text-slate-500">
            {emptyCopy}
          </div>)}

        <DropdownMenuItem render={<Link href={dashboardHref}/>} className="cursor-pointer justify-center rounded-md py-2 text-xs font-medium text-slate-600">
          {dashboardLabel}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
