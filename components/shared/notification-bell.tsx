"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Bell, Inbox } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger, } from "@/components/ui/dropdown-menu";
import { ROUTES } from "@/lib/constants";
import { partitionByOpened, sortByCreatedDesc, triageCounts, type InquiryTriageRow } from "@/lib/inquiry-triage";
import { cn } from "@/lib/utils";
type NotificationBellProps = {
    unreadCount?: number;
    inquirySummaries?: InquiryTriageRow[];
    viewedInquiryIds?: string[];
    triggerClassName?: string;
};
export function NotificationBell({ unreadCount = 0, inquirySummaries, viewedInquiryIds = [], triggerClassName, }: NotificationBellProps) {
    const router = useRouter();
    const hasInquiryQueue = inquirySummaries !== undefined;
    const rows = React.useMemo(() => (hasInquiryQueue ? sortByCreatedDesc(inquirySummaries!) : []), [hasInquiryQueue, inquirySummaries]);
    const { unread } = React.useMemo(() => hasInquiryQueue ? partitionByOpened(rows, viewedInquiryIds) : { unread: [], read: [] }, [hasInquiryQueue, rows, viewedInquiryIds]);
    const counts = React.useMemo(() => hasInquiryQueue ? triageCounts(rows, viewedInquiryIds) : { totalUnopened: 0 }, [hasInquiryQueue, rows, viewedInquiryIds]);
    const queueBadge = counts.totalUnopened;
    const queueBadgeEl = queueBadge > 0 ? (<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[10px] font-bold leading-none text-white dark:bg-rose-500">
        {queueBadge > 99 ? "99+" : queueBadge}
      </span>) : null;
    if (!hasInquiryQueue) {
        return (<Button type="button" variant="outline" size="icon" aria-label="Open notifications" className="relative rounded-none border-slate-200 bg-white">
        <Bell className="h-4 w-4"/>
        {unreadCount > 0 ? (<span className="absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-sm bg-[#d97706] px-1 text-[10px] font-bold leading-none text-white">
            {unreadCount > 99 ? "99+" : unreadCount}
          </span>) : null}
      </Button>);
    }
    const preview = unread.slice(0, 4);
    return (<DropdownMenu>
      <DropdownMenuTrigger type="button" aria-label={queueBadge > 0 ? `Inbox, ${queueBadge} unread` : "Inbox"} className={cn("relative inline-flex size-8 shrink-0 items-center justify-center rounded-xl border text-sm font-medium transition-colors outline-none select-none", "border-slate-200/90 bg-white/90 text-slate-800 hover:bg-slate-50 dark:border-zinc-700/90 dark:bg-zinc-900/55 dark:text-zinc-100 dark:hover:bg-zinc-800/70", "focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50", "data-popup-open:border-border data-popup-open:bg-muted/80", triggerClassName)}>
        <Inbox className="h-4 w-4" aria-hidden/>
        {queueBadgeEl}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" sideOffset={8} className="w-56 p-1 sm:w-56">
        <div className="px-2 py-2">
          <p className="text-xs text-muted-foreground">
            {queueBadge > 0 ? (<>
                <span className="font-semibold text-foreground">{queueBadge}</span> unread
              </>) : (<span className="text-emerald-700 dark:text-emerald-400/90">Inbox clear</span>)}
          </p>
        </div>

        {preview.length > 0 ? (<>
            {preview.map((row) => (<DropdownMenuItem key={row.id} className="cursor-pointer truncate rounded-md py-2 text-sm" onClick={() => router.push(`${ROUTES.INQUIRIES}?open=${encodeURIComponent(row.id)}`)}>
                {row.name}
              </DropdownMenuItem>))}
            <DropdownMenuSeparator className="my-1"/>
          </>) : null}

        <DropdownMenuItem className="cursor-pointer justify-center rounded-md py-2 font-medium" onClick={() => router.push(ROUTES.INQUIRIES)}>
          Open inbox
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>);
}
