"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { listWorkNotifications, markAllWorkNotificationsRead, markWorkNotificationRead, } from "@/services/work-notification-service";
import type { UserNotification } from "@/types/database";
export function useWorkNotifications(userId: string | undefined) {
    const router = useRouter();
    const [items, setItems] = React.useState<UserNotification[]>([]);
    const [loading, setLoading] = React.useState(true);
    const toastedIdsRef = React.useRef<Set<string>>(new Set());
    const refresh = React.useCallback(async () => {
        if (!userId) {
            setItems([]);
            setLoading(false);
            return;
        }
        try {
            const rows = await listWorkNotifications(userId);
            setItems(rows);
        }
        finally {
            setLoading(false);
        }
    }, [userId]);
    React.useEffect(() => {
        void refresh();
    }, [refresh]);
    React.useEffect(() => {
        if (!userId)
            return;
        const sb = createClient();
        const channelName = `work-notifications:${userId}`;
        const channel = sb
            .channel(channelName)
            .on("postgres_changes", {
            event: "INSERT",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${userId}`,
        }, (payload) => {
            const row = payload.new as UserNotification;
            setItems((prev) => {
                if (prev.some((n) => n.id === row.id))
                    return prev;
                return [row, ...prev];
            });
            if (toastedIdsRef.current.has(row.id))
                return;
            toastedIdsRef.current.add(row.id);
            toast(row.title, {
                description: row.body,
                duration: 8000,
                action: {
                    label: row.kind === "milestone_delivered" ||
                        row.kind === "project_completed"
                        ? "View project"
                        : "Open task",
                    onClick: () => router.push(row.href),
                },
            });
        })
            .on("postgres_changes", {
            event: "UPDATE",
            schema: "public",
            table: "user_notifications",
            filter: `user_id=eq.${userId}`,
        }, (payload) => {
            const row = payload.new as UserNotification;
            setItems((prev) => prev.map((n) => (n.id === row.id ? row : n)));
        })
            .subscribe();
        return () => {
            removeRealtimeChannelByName(sb, channelName);
            void sb.removeChannel(channel);
        };
    }, [router, userId]);
    const unreadCount = React.useMemo(() => items.filter((n) => !n.read_at).length, [items]);
    const markRead = React.useCallback(async (id: string) => {
        await markWorkNotificationRead(id);
        setItems((prev) => prev.map((n) => n.id === id ? { ...n, read_at: new Date().toISOString() } : n));
    }, []);
    const markAllRead = React.useCallback(async () => {
        if (!userId)
            return;
        await markAllWorkNotificationsRead(userId);
        const now = new Date().toISOString();
        setItems((prev) => prev.map((n) => ({ ...n, read_at: n.read_at ?? now })));
    }, [userId]);
    return {
        items,
        unreadCount,
        loading,
        refresh,
        markRead,
        markAllRead,
    };
}
