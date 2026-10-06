"use client";
import { Bell } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import type { UserNotification } from "@/types/database";

function formatWhen(iso: string) {
    const diffMs = Date.now() - new Date(iso).getTime();
    const mins = Math.floor(diffMs / 60000);
    if (mins < 1)
        return "Just now";
    if (mins < 60)
        return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24)
        return `${hrs}h ago`;
    return new Date(iso).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

export type NotificationsState = {
    items: UserNotification[];
    unreadCount: number;
    emptyMessage: string;
    onOpen: (item: UserNotification) => void;
    onMarkAllRead: () => void;
};

type NotificationsMenuProps = NotificationsState & {
    appearance: "row" | "icon";
    side?: "right" | "bottom";
};

export function NotificationsMenu({ items, unreadCount, emptyMessage, onOpen, onMarkAllRead, appearance, side = "bottom" }: NotificationsMenuProps) {
    const label = unreadCount > 0 ? `Notifications, ${unreadCount} unread` : "Notifications";
    const count = unreadCount > 99 ? "99+" : String(unreadCount);
    return (<DropdownMenu>
      <DropdownMenuTrigger type="button" aria-label={label} className={cn("relative cursor-pointer outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring/40", appearance === "row"
            ? "flex h-9 w-full items-center gap-3 rounded-md px-2.5 text-sm text-rail-ink-secondary hover:bg-rail-raised hover:text-rail-ink data-popup-open:bg-rail-raised data-popup-open:text-rail-ink"
            : "inline-flex size-9 items-center justify-center rounded-md text-rail-ink-secondary hover:bg-rail-raised hover:text-rail-ink data-popup-open:bg-rail-raised")}>
        <Bell className="size-4 shrink-0" aria-hidden/>
        {appearance === "row" ? (<>
            <span className="min-w-0 flex-1 truncate text-left">Notifications</span>
            {unreadCount > 0 ? (<span className="rounded-sm bg-brand px-1.5 font-mono text-[11px] leading-5 font-medium text-white">{count}</span>) : null}
          </>) : unreadCount > 0 ? (<span className="absolute top-1.5 right-1.5 size-2 rounded-full bg-brand-bright ring-2 ring-rail" aria-hidden/>) : null}
      </DropdownMenuTrigger>
      <DropdownMenuContent side={side} align="end" sideOffset={8} className="w-[min(calc(100vw-2rem),24rem)] p-0">
        <div className="flex items-center justify-between gap-3 border-b border-line px-3.5 py-2.5">
          <p className="text-sm font-semibold text-ink">Notifications</p>
          {unreadCount > 0 ? (<button type="button" onClick={onMarkAllRead} className="cursor-pointer text-[13px] text-ink-secondary underline-offset-4 hover:text-ink hover:underline">
              Mark all as read
            </button>) : null}
        </div>
        {items.length === 0 ? (<p className="px-3.5 py-8 text-center text-sm text-ink-secondary">{emptyMessage}</p>) : (<div className="max-h-[min(60vh,26rem)] overflow-y-auto p-1">
            {items.map((item) => {
                const unread = !item.read_at;
                return (<DropdownMenuItem key={item.id} onClick={() => onOpen(item)} className="cursor-pointer items-start gap-3 px-2.5 py-2.5">
                  <span className={cn("mt-1.5 size-1.5 shrink-0 rounded-full", unread ? "bg-brand" : "bg-transparent")} aria-hidden/>
                  <span className="min-w-0 flex-1">
                    <span className={cn("block text-sm leading-snug", unread ? "font-medium text-ink" : "text-ink-secondary")}>
                      {item.title}
                    </span>
                    <span className="mt-0.5 line-clamp-2 block text-[13px] leading-snug text-ink-secondary">{item.body}</span>
                    <span className="mt-1 block text-xs text-ink-tertiary">{formatWhen(item.created_at)}</span>
                  </span>
                  {unread ? <span className="sr-only">Unread</span> : null}
                </DropdownMenuItem>);
            })}
          </div>)}
      </DropdownMenuContent>
    </DropdownMenu>);
}
