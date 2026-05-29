"use client";
import * as React from "react";
import { usePathname } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { countUnreadChatMessages } from "@/services/chat-presence-service";
import type { ChatMessage, ProjectChatReadCursor } from "@/types/database";
const POLL_MS = 12000;
export function useUnreadChatCount(projectId: string, viewerId: string, initialCount: number): number {
    const pathname = usePathname();
    const isOnMessages = pathname.includes("/messages");
    const [count, setCount] = React.useState(initialCount);
    React.useEffect(() => {
        setCount(initialCount);
    }, [initialCount]);
    React.useEffect(() => {
        if (isOnMessages) {
            setCount(0);
        }
    }, [isOnMessages]);
    const refreshCount = React.useCallback(async () => {
        if (isOnMessages) {
            setCount(0);
            return;
        }
        try {
            const next = await countUnreadChatMessages(projectId, viewerId);
            setCount(next);
        }
        catch {
        }
    }, [projectId, viewerId, isOnMessages]);
    React.useEffect(() => {
        if (isOnMessages)
            return;
        const sb = createClient();
        const channelName = `chat-unread:${projectId}:${viewerId}`;
        removeRealtimeChannelByName(sb, channelName);
        const channel = sb
            .channel(channelName)
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `project_id=eq.${projectId}`,
        }, (payload) => {
            const row = payload.new as ChatMessage;
            if (row.sender_id === viewerId)
                return;
            setCount((prev) => prev + 1);
        })
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "project_chat_read_cursors",
            filter: `project_id=eq.${projectId}`,
        }, (payload) => {
            const row = payload.new as ProjectChatReadCursor;
            if (row?.user_id === viewerId) {
                setCount(0);
            }
        })
            .subscribe();
        const poll = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void refreshCount();
            }
        }, POLL_MS);
        return () => {
            window.clearInterval(poll);
            void sb.removeChannel(channel);
        };
    }, [projectId, viewerId, isOnMessages, refreshCount]);
    return isOnMessages ? 0 : count;
}
