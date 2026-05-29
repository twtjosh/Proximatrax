"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { ChevronRight, Mail } from "lucide-react";
import { markInquiryViewedAction } from "@/app/(dashboard)/inquiries/actions";
import { InquiryQueueSummary } from "@/components/superadmin/inquiry-stats-tiles";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, } from "@/components/ui/dialog";
import { ROUTES } from "@/lib/constants";
import { cn } from "@/lib/utils";
import type { Inquiry, InquiryStatus } from "@/types/database";
import { toast } from "sonner";
const STATUS_LABEL: Record<InquiryStatus, string> = {
    new: "New",
    contacted: "Contacted",
    converted: "Converted",
    closed: "Closed",
};
const STATUS_BADGE: Record<InquiryStatus, "default" | "secondary" | "outline" | "destructive"> = {
    new: "default",
    contacted: "secondary",
    converted: "outline",
    closed: "outline",
};
type BadgeVariant = (typeof STATUS_BADGE)[InquiryStatus];
function rowListBadge(row: Inquiry, isUnread: boolean): {
    label: string;
    variant: BadgeVariant;
} | null {
    if (row.status === "new" && !isUnread) {
        return null;
    }
    return { label: STATUS_LABEL[row.status], variant: STATUS_BADGE[row.status] };
}
function formatDate(iso: string) {
    try {
        return new Intl.DateTimeFormat(undefined, {
            dateStyle: "medium",
            timeStyle: "short",
        }).format(new Date(iso));
    }
    catch {
        return iso;
    }
}
function initials(name: string) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length === 0)
        return "?";
    if (parts.length === 1)
        return parts[0]!.slice(0, 2).toUpperCase();
    return `${parts[0]![0]}${parts[parts.length - 1]![0]}`.toUpperCase();
}
type InquiryInboxProps = {
    inquiries: Inquiry[];
    viewedInquiryIds: string[];
    openInquiryId?: string;
};
function InquiryRowButton({ row, isUnread, onOpen, }: {
    row: Inquiry;
    isUnread: boolean;
    onOpen: (row: Inquiry) => void;
}) {
    const isPipelineNew = row.status === "new";
    const badge = rowListBadge(row, isUnread);
    return (<button type="button" id={`inquiry-${row.id}`} onClick={() => onOpen(row)} className={cn("group flex w-full items-center gap-3 px-3 py-2.5 text-left transition-colors sm:gap-3 sm:px-4 sm:py-2.5", "hover:bg-zinc-50/90 dark:hover:bg-zinc-900/30", "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background dark:focus-visible:ring-offset-zinc-950", isUnread ? "bg-white dark:bg-zinc-950/20" : "bg-zinc-50/40 dark:bg-zinc-900/25", isUnread && isPipelineNew && "border-l-2 border-l-rose-500 pl-[10px] sm:pl-[14px] dark:border-l-rose-400")} aria-label={`${isUnread ? "Unread" : "Read"} — ${row.name}`}>
      <span className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg border text-[11px] font-semibold tabular-nums sm:size-9 sm:text-xs", "border-zinc-200/90 bg-zinc-50 text-zinc-600 dark:border-zinc-700/80 dark:bg-zinc-900/50 dark:text-zinc-400", isUnread && "border-zinc-200 bg-white text-zinc-800 dark:border-zinc-600 dark:bg-zinc-900 dark:text-zinc-200", isUnread && isPipelineNew && "border-rose-200/80 bg-rose-50 text-rose-900 dark:border-rose-500/30 dark:bg-rose-500/10 dark:text-rose-100")} aria-hidden>
        {initials(row.name)}
      </span>

      <div className="min-w-0 flex-1 space-y-0.5">
        <p className={cn("truncate text-[0.9375rem] sm:text-[0.95rem]", isUnread ? "font-semibold text-zinc-950 dark:text-white" : "font-normal text-zinc-600 dark:text-zinc-400")}>
          {row.name}
        </p>
        <p className="truncate text-xs text-zinc-500 dark:text-zinc-500">{row.email}</p>
        <time className="font-mono text-[10px] text-zinc-500 sm:hidden dark:text-zinc-500" dateTime={row.created_at}>
          {formatDate(row.created_at)}
        </time>
      </div>

      <div className="hidden shrink-0 flex-col items-end gap-0.5 sm:flex">
        {badge ? (<Badge variant={badge.variant} className="text-[10px] font-normal">
            {badge.label}
          </Badge>) : (<span className="h-5 w-10 shrink-0 sm:w-12" aria-hidden/>)}
        <time className="font-mono text-[10px] text-zinc-500 dark:text-zinc-500" dateTime={row.created_at}>
          {formatDate(row.created_at)}
        </time>
      </div>

      <div className="flex shrink-0 items-center gap-1.5 sm:hidden">
        {badge ? (<Badge variant={badge.variant} className="max-w-22 truncate text-[10px] font-normal">
            {badge.label}
          </Badge>) : (<span className="h-5 w-8 shrink-0" aria-hidden/>)}
        <ChevronRight className="size-4 text-zinc-400 opacity-60 dark:text-zinc-500" aria-hidden/>
      </div>

      <ChevronRight className="hidden size-4 shrink-0 text-zinc-400 opacity-60 sm:block dark:text-zinc-500" aria-hidden/>
    </button>);
}
export function InquiryInbox({ inquiries, viewedInquiryIds: serverViewedIds, openInquiryId, }: InquiryInboxProps) {
    const router = useRouter();
    const viewedSet = React.useMemo(() => new Set(serverViewedIds), [serverViewedIds]);
    const [open, setOpen] = React.useState(false);
    const [active, setActive] = React.useState<Inquiry | null>(null);
    const handledOpenParamRef = React.useRef<string | null>(null);
    const sorted = React.useMemo(() => [...inquiries].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()), [inquiries]);
    React.useEffect(() => {
        const hash = typeof window !== "undefined" ? window.location.hash.slice(1) : "";
        if (!hash)
            return;
        const scrollTimer = window.setTimeout(() => {
            document.getElementById(`inquiry-${hash}`)?.scrollIntoView({
                block: "center",
                behavior: "smooth",
            });
        }, 120);
        return () => clearTimeout(scrollTimer);
    }, [inquiries]);
    const openInquiry = React.useCallback(async (row: Inquiry) => {
        if (!viewedSet.has(row.id)) {
            const res = await markInquiryViewedAction(row.id);
            if (!res.ok) {
                toast.error(res.error);
                return;
            }
            await router.refresh();
        }
        setActive(row);
        setOpen(true);
    }, [router, viewedSet]);
    React.useEffect(() => {
        if (!openInquiryId) {
            handledOpenParamRef.current = null;
            return;
        }
        if (handledOpenParamRef.current === openInquiryId)
            return;
        const row = sorted.find((r) => r.id === openInquiryId);
        if (!row) {
            handledOpenParamRef.current = openInquiryId;
            router.replace(ROUTES.INQUIRIES, { scroll: false });
            return;
        }
        handledOpenParamRef.current = openInquiryId;
        void openInquiry(row).finally(() => {
            router.replace(ROUTES.INQUIRIES, { scroll: false });
        });
    }, [openInquiryId, sorted, openInquiry, router]);
    function handleOpenChange(next: boolean) {
        setOpen(next);
        if (!next)
            setActive(null);
    }
    return (<div className="space-y-4">
      <InquiryQueueSummary inquiries={inquiries} viewedInquiryIds={serverViewedIds}/>

      <ul className="divide-y divide-zinc-100 overflow-hidden rounded-xl border border-zinc-200/80 bg-zinc-50/50 dark:divide-zinc-800 dark:border-zinc-800/80 dark:bg-zinc-950/40" role="list">
        {sorted.map((row) => {
            const isUnread = !viewedSet.has(row.id);
            return (<li key={row.id}>
              <InquiryRowButton row={row} isUnread={isUnread} onOpen={openInquiry}/>
            </li>);
        })}
      </ul>

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent showCloseButton className="flex max-h-[min(88vh,40rem)] max-w-[calc(100%-2rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
          {active ? (<>
              <DialogHeader className="shrink-0 space-y-3 border-b border-border/70 px-5 py-4 pr-12 text-left sm:px-6">
                <div className="flex flex-wrap items-center gap-2">
                  {!(active.status === "new" && viewedSet.has(active.id)) ? (<Badge variant={STATUS_BADGE[active.status]}>
                      {STATUS_LABEL[active.status]}
                    </Badge>) : null}
                  <time className="font-mono text-[10px] font-medium uppercase tracking-[0.14em] text-muted-foreground" dateTime={active.created_at}>
                    {formatDate(active.created_at)}
                  </time>
                </div>
                <DialogTitle className="text-lg sm:text-xl">{active.name}</DialogTitle>
                <DialogDescription className="text-sm">
                  <a href={`mailto:${encodeURIComponent(active.email)}`} className="inline-flex items-center gap-2 font-medium text-rose-700 underline decoration-rose-300/80 underline-offset-4 transition-colors hover:text-rose-900 dark:text-rose-300 dark:hover:text-rose-200">
                    <Mail className="size-3.5 shrink-0 opacity-80" aria-hidden/>
                    <span className="break-all">{active.email}</span>
                  </a>
                </DialogDescription>
              </DialogHeader>

              <div className="min-h-0 flex-1 overflow-y-auto px-5 py-4 sm:px-6">
                <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-muted-foreground">
                  Message
                </p>
                <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                  {active.message}
                </p>

                {active.notes ? (<div className="mt-6 rounded-xl border border-amber-200/80 bg-amber-50/90 px-4 py-3 dark:border-amber-500/25 dark:bg-amber-950/35">
                    <p className="font-mono text-[10px] font-medium uppercase tracking-[0.2em] text-amber-900/80 dark:text-amber-200/90">
                      Internal notes
                    </p>
                    <p className="mt-1.5 whitespace-pre-wrap text-sm leading-relaxed text-amber-950/95 dark:text-amber-50/95">
                      {active.notes}
                    </p>
                  </div>) : null}
              </div>

              <DialogFooter className="m-0 shrink-0 flex-col gap-2 border-t border-border/70 bg-muted/25 p-4 sm:flex-row sm:items-center sm:justify-end sm:gap-3 sm:px-5">
                <Button variant="default" className="w-full border-0 bg-linear-to-r from-emerald-600 to-teal-600 font-semibold text-white shadow-md shadow-emerald-950/20 ring-1 ring-emerald-500/35 hover:from-emerald-500 hover:to-teal-500 hover:shadow-lg hover:shadow-emerald-950/25 focus-visible:ring-emerald-400/60 sm:w-auto dark:from-emerald-500 dark:to-teal-500 dark:ring-emerald-400/25 dark:hover:from-emerald-400 dark:hover:to-teal-400" render={<a href={`mailto:${encodeURIComponent(active.email)}?subject=${encodeURIComponent(`Re: your inquiry to ProximaTrax`)}`}/>}>
                  <Mail className="size-4" aria-hidden/>
                  Reply by email
                </Button>
              </DialogFooter>
            </>) : null}
        </DialogContent>
      </Dialog>
    </div>);
}
