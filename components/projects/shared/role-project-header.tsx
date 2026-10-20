"use client";
import { useRouter } from "next/navigation";
import { ArrowLeft, MessageSquare } from "lucide-react";
import { focusRing, ProgressRing, softAction } from "@/components/dashboard/overview-kit";
import { useLiveUnread } from "@/components/messenger/messenger-store";
import { OpenChatButton } from "@/components/messenger/open-chat-button";
import { cn } from "@/lib/utils";

/**
 * A crew member's or client's project identity on every tab: a ring, the
 * title, one status line and Message. Condenses like the PM header,
 * by scale and fade only: its height never changes, so scrolling can't make
 * it jump.
 */
export function RoleProjectHeader({ projectId, title, share, done, status, unread, compact, home, messageLabel }: {
    projectId: string;
    title: string;
    /** 0..1, drawn by the ring and shown inside it as a percentage. */
    share: number;
    /** Draw the ring green: everything it counts is finished. */
    done: boolean;
    status: React.ReactNode;
    unread: number;
    compact: boolean;
    /** Where Back goes when there is no in-app history. */
    home: string;
    messageLabel: string;
}) {
    const router = useRouter();
    const liveUnread = useLiveUnread(projectId, unread);

    // ponytail: same-origin referrer means we came from inside the app; deep links fall back to the role's home.
    function back() {
        if (document.referrer.startsWith(window.location.origin) && window.history.length > 1)
            router.back();
        else
            router.push(home);
    }

    return (<div className="flex items-center gap-4">
      <ProgressRing value={share} done={done} size={54} stroke={5.5} className={cn("origin-left transition-[scale,translate] duration-500 ease-spring motion-reduce:transition-none", compact && "translate-y-2 scale-[0.67]")}>
        {/* The ring shrinks to two thirds when condensed; the number grows a little against it so it stays readable. */}
        <span className={cn("block text-[13px] font-semibold text-ink tabular transition-transform duration-500 ease-spring motion-reduce:transition-none", compact && "scale-[1.15]")}>{Math.round(share * 100)}</span>
      </ProgressRing>
      <div className="min-w-0 flex-1">
        <button type="button" onClick={back} tabIndex={compact ? -1 : undefined} aria-hidden={compact || undefined} className={cn("mb-0.5 inline-flex items-center gap-1 rounded-sm text-xs font-medium text-ink-tertiary transition-opacity duration-300 hover:text-ink motion-reduce:transition-none", compact && "pointer-events-none opacity-0", focusRing)}>
          <ArrowLeft className="size-3.5" aria-hidden/>
          Back
        </button>
        <h1 className={cn("origin-left truncate text-[1.75rem] leading-[1.05] font-semibold tracking-[-0.034em] text-ink transition-transform duration-500 ease-spring motion-reduce:transition-none", compact && "translate-y-2 scale-[0.68]")}>{title}</h1>
        <p className={cn("truncate text-[13px] text-ink-tertiary transition-opacity duration-300 motion-reduce:transition-none", compact && "opacity-0")}>{status}</p>
      </div>
      <OpenChatButton projectId={projectId} aria-label={liveUnread > 0 ? `${messageLabel}, ${liveUnread} unread` : messageLabel} className={cn(softAction, "relative h-9 px-3.5", liveUnread > 0 && "bg-brand-soft text-brand ring-1 ring-brand/20 hover:bg-brand-soft")}>
        <MessageSquare aria-hidden/>
        <span className="max-sm:hidden">{messageLabel}</span>
        {liveUnread > 0 ? <span aria-hidden className="grid h-4 min-w-4 place-items-center rounded-full bg-brand px-1 text-[10px] font-semibold text-white tabular max-sm:absolute max-sm:-top-1 max-sm:-right-1 max-sm:ring-2 max-sm:ring-surface">{liveUnread > 9 ? "9+" : liveUnread}</span> : null}
      </OpenChatButton>
    </div>);
}
