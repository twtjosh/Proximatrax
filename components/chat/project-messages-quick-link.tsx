"use client";
import Link from "next/link";
import { MessageSquare } from "lucide-react";
import { ChatUnreadBadge } from "@/components/chat/chat-unread-badge";
import { Button } from "@/components/ui/button";
import { projectMessagesPath } from "@/lib/constants";
import { cn } from "@/lib/utils";
export function ProjectMessagesQuickLink({ projectId, viewerId, initialUnreadChatCount, isClient, }: {
    projectId: string;
    viewerId: string;
    initialUnreadChatCount: number;
    isClient: boolean;
}) {
    return (<Button render={<Link href={projectMessagesPath(projectId)} className="relative"/>} size="sm" variant="outline" className={cn("relative text-[10px] uppercase tracking-wide", isClient
            ? "h-11 w-full min-w-0 justify-center gap-1.5 rounded-lg border-stone-200 px-2 font-medium normal-case sm:text-[11px]"
            : "h-8 rounded-none border-slate-200 px-2 font-mono")}>
      <MessageSquare className="h-3.5 w-3.5 shrink-0"/>
      {isClient ? "Messages" : "Msgs"}
      <ChatUnreadBadge projectId={projectId} viewerId={viewerId} initialCount={initialUnreadChatCount} variant="dot" className="-right-0.5 -top-0.5"/>
    </Button>);
}
