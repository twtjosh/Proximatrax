"use client";
import * as React from "react";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { listChatMessages } from "@/services/chat-service";
import { markProjectChatRead, type ChatParticipant, } from "@/services/chat-presence-service";
import type { ChatMessage, ChatMessageAttachment, Profile, ProjectChatReadCursor, } from "@/types/database";
const TYPING_TTL_MS = 3000;
const READ_DEBOUNCE_MS = 800;
const POLL_MS = 8000;
export type TypingUser = Pick<Profile, "id" | "full_name">;
type UseProjectChatRealtimeOptions = {
    projectId: string;
    viewerId: string;
    initialMessages: ChatMessage[];
    initialAttachments: ChatMessageAttachment[];
    senderProfiles: Record<string, Pick<Profile, "id" | "full_name" | "avatar_url">>;
    participants: ChatParticipant[];
    initialReadCursors: ProjectChatReadCursor[];
    onAttachmentsChange?: (attachments: ChatMessageAttachment[]) => void;
};
export function useProjectChatRealtime({ projectId, viewerId, initialMessages, initialAttachments, senderProfiles, participants, initialReadCursors, onAttachmentsChange, }: UseProjectChatRealtimeOptions) {
    const [messages, setMessages] = React.useState<ChatMessage[]>(initialMessages);
    const [attachments, setAttachments] = React.useState<ChatMessageAttachment[]>(initialAttachments);
    const [senders, setSenders] = React.useState<Record<string, Pick<Profile, "id" | "full_name" | "avatar_url">>>(senderProfiles);
    const [readCursors, setReadCursors] = React.useState<ProjectChatReadCursor[]>(initialReadCursors);
    const [typingUsers, setTypingUsers] = React.useState<TypingUser[]>([]);
    const onAttachmentsChangeRef = React.useRef(onAttachmentsChange);
    const typingExpiryRef = React.useRef<Map<string, ReturnType<typeof setTimeout>>>(new Map());
    const readTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const channelRef = React.useRef<ReturnType<ReturnType<typeof createClient>["channel"]> | null>(null);
    React.useEffect(() => {
        onAttachmentsChangeRef.current = onAttachmentsChange;
    }, [onAttachmentsChange]);
    React.useEffect(() => {
        setMessages(initialMessages);
    }, [initialMessages]);
    React.useEffect(() => {
        setAttachments(initialAttachments);
    }, [initialAttachments]);
    React.useEffect(() => {
        setSenders((prev) => ({ ...senderProfiles, ...prev }));
    }, [senderProfiles]);
    React.useEffect(() => {
        setReadCursors(initialReadCursors);
    }, [initialReadCursors]);
    const ensureSender = React.useCallback((senderId: string) => {
        setSenders((prev) => {
            if (prev[senderId])
                return prev;
            const participant = participants.find((p) => p.id === senderId);
            if (participant) {
                return { ...prev, [senderId]: participant };
            }
            void createClient()
                .from("profiles")
                .select("id, full_name, avatar_url")
                .eq("id", senderId)
                .maybeSingle()
                .then(({ data }) => {
                if (data) {
                    setSenders((current) => ({
                        ...current,
                        [senderId]: data as Pick<Profile, "id" | "full_name" | "avatar_url">,
                    }));
                }
            });
            return prev;
        });
    }, [participants]);
    const refreshMessages = React.useCallback(async () => {
        try {
            const rows = await listChatMessages(projectId, 200);
            setMessages(rows);
        }
        catch {
        }
    }, [projectId]);
    const scheduleMarkRead = React.useCallback(() => {
        if (readTimerRef.current)
            clearTimeout(readTimerRef.current);
        readTimerRef.current = setTimeout(() => {
            readTimerRef.current = null;
            void markProjectChatRead(projectId).catch(() => { });
        }, READ_DEBOUNCE_MS);
    }, [projectId]);
    const upsertTypingUser = React.useCallback((user: TypingUser) => {
        if (user.id === viewerId)
            return;
        setTypingUsers((prev) => {
            if (prev.some((u) => u.id === user.id))
                return prev;
            return [...prev, user];
        });
        const existing = typingExpiryRef.current.get(user.id);
        if (existing)
            clearTimeout(existing);
        typingExpiryRef.current.set(user.id, setTimeout(() => {
            typingExpiryRef.current.delete(user.id);
            setTypingUsers((prev) => prev.filter((u) => u.id !== user.id));
        }, TYPING_TTL_MS));
    }, [viewerId]);
    const clearTypingUser = React.useCallback((userId: string) => {
        const existing = typingExpiryRef.current.get(userId);
        if (existing)
            clearTimeout(existing);
        typingExpiryRef.current.delete(userId);
        setTypingUsers((prev) => prev.filter((u) => u.id !== userId));
    }, []);
    const broadcastTyping = React.useCallback((typing: boolean) => {
        const channel = channelRef.current;
        if (!channel)
            return;
        const self = participants.find((p) => p.id === viewerId);
        void channel.send({
            type: "broadcast",
            event: "typing",
            payload: {
                user_id: viewerId,
                full_name: self?.full_name ?? "Someone",
                typing,
            },
        });
    }, [participants, viewerId]);
    React.useEffect(() => {
        const sb = createClient();
        const channelName = `chat:${projectId}`;
        removeRealtimeChannelByName(sb, channelName);
        const channel = sb.channel(channelName, {
            config: { broadcast: { self: false } },
        });
        channelRef.current = channel;
        channel
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "chat_messages",
            filter: `project_id=eq.${projectId}`,
        }, (payload) => {
            const row = payload.new as ChatMessage;
            setMessages((prev) => {
                if (prev.some((m) => m.id === row.id))
                    return prev;
                return [...prev, row];
            });
            ensureSender(row.sender_id);
            if (document.visibilityState === "visible") {
                scheduleMarkRead();
            }
        })
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "chat_message_attachments",
            filter: `project_id=eq.${projectId}`,
        }, (payload) => {
            const row = payload.new as ChatMessageAttachment;
            setAttachments((prev) => {
                if (prev.some((a) => a.id === row.id))
                    return prev;
                const next = [row, ...prev];
                onAttachmentsChangeRef.current?.(next);
                return next;
            });
        })
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "project_chat_read_cursors",
            filter: `project_id=eq.${projectId}`,
        }, (payload) => {
            const row = payload.new as ProjectChatReadCursor;
            if (!row?.user_id)
                return;
            setReadCursors((prev) => {
                const rest = prev.filter((c) => c.user_id !== row.user_id);
                return [...rest, row];
            });
        })
            .on("broadcast", { event: "typing" }, ({ payload }) => {
            const data = payload as {
                user_id?: string;
                full_name?: string;
                typing?: boolean;
            };
            if (!data.user_id || data.user_id === viewerId)
                return;
            if (data.typing) {
                upsertTypingUser({
                    id: data.user_id,
                    full_name: data.full_name ?? "Someone",
                });
            }
            else {
                clearTypingUser(data.user_id);
            }
        })
            .subscribe();
        void markProjectChatRead(projectId).catch(() => { });
        const poll = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void refreshMessages();
            }
        }, POLL_MS);
        return () => {
            if (readTimerRef.current)
                clearTimeout(readTimerRef.current);
            for (const timer of typingExpiryRef.current.values()) {
                clearTimeout(timer);
            }
            typingExpiryRef.current.clear();
            window.clearInterval(poll);
            channelRef.current = null;
            void sb.removeChannel(channel);
        };
    }, [
        projectId,
        viewerId,
        ensureSender,
        scheduleMarkRead,
        upsertTypingUser,
        clearTypingUser,
        refreshMessages,
    ]);
    React.useEffect(() => {
        if (document.visibilityState === "visible") {
            scheduleMarkRead();
        }
    }, [messages.length, scheduleMarkRead]);
    const pushMessage = React.useCallback((msg: ChatMessage) => {
        setMessages((prev) => {
            if (prev.some((m) => m.id === msg.id))
                return prev;
            return [...prev, msg];
        });
        ensureSender(msg.sender_id);
        scheduleMarkRead();
    }, [ensureSender, scheduleMarkRead]);
    const pushAttachment = React.useCallback((item: ChatMessageAttachment) => {
        setAttachments((prev) => {
            if (prev.some((a) => a.id === item.id))
                return prev;
            const next = [item, ...prev];
            onAttachmentsChangeRef.current?.(next);
            return next;
        });
    }, []);
    return {
        messages,
        attachments,
        senders,
        readCursors,
        typingUsers,
        pushMessage,
        pushAttachment,
        broadcastTyping,
        scheduleMarkRead,
    };
}
export function formatTypingLabel(users: TypingUser[]): string | null {
    if (users.length === 0)
        return null;
    if (users.length === 1)
        return `${users[0].full_name} is typing…`;
    if (users.length === 2) {
        return `${users[0].full_name} and ${users[1].full_name} are typing…`;
    }
    return `${users.length} people are typing…`;
}
export function usersWhoSeenMessage(message: ChatMessage, readCursors: ProjectChatReadCursor[], participants: ChatParticipant[], viewerId: string): ChatParticipant[] {
    const messageTime = new Date(message.created_at).getTime();
    return participants.filter((p) => {
        if (p.id === viewerId || p.id === message.sender_id)
            return false;
        const cursor = readCursors.find((c) => c.user_id === p.id);
        if (!cursor)
            return false;
        return new Date(cursor.last_read_at).getTime() >= messageTime;
    });
}
export function usersSeenUpToLatest(latestMessage: ChatMessage | undefined, readCursors: ProjectChatReadCursor[], participants: ChatParticipant[], viewerId: string): ChatParticipant[] {
    if (!latestMessage)
        return [];
    return usersWhoSeenMessage(latestMessage, readCursors, participants, viewerId);
}
