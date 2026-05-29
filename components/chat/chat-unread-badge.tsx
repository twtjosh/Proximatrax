"use client";
import { cn } from "@/lib/utils";
import { useUnreadChatCount } from "@/hooks/use-unread-chat-count";
type ChatUnreadBadgeProps = {
    projectId: string;
    viewerId: string;
    initialCount: number;
    className?: string;
    variant?: "pill" | "dot";
};
export function ChatUnreadBadge({ projectId, viewerId, initialCount, className, variant = "pill", }: ChatUnreadBadgeProps) {
    const count = useUnreadChatCount(projectId, viewerId, initialCount);
    if (count <= 0)
        return null;
    const label = count > 99 ? "99+" : String(count);
    if (variant === "dot") {
        return (<span className={cn("absolute -right-1 -top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-rose-600 px-1 text-[9px] font-bold leading-none text-white", className)} title={`${count} unread message${count === 1 ? "" : "s"}`} aria-label={`${count} unread message${count === 1 ? "" : "s"}`}>
        {label}
      </span>);
    }
    return (<span className={cn("inline-flex min-h-5 min-w-5 items-center justify-center rounded-full bg-rose-600 px-1.5 text-[10px] font-bold tabular-nums leading-none text-white", className)} title={`${count} unread message${count === 1 ? "" : "s"}`} aria-label={`${count} unread message${count === 1 ? "" : "s"}`}>
      {label}
    </span>);
}
