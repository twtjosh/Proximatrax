"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { createClient, subscribeAsViewer } from "@/lib/supabase/client";
import { listWorkNotifications, markAllWorkNotificationsRead, markWorkNotificationRead, } from "@/services/work-notification-service";
import type { UserNotification } from "@/types/database";
/** The toast's button, by what the notification is about. */
const ACTION_LABEL: Record<string, string> = {
    milestone_delivered: "View project",
    project_completed: "View project",
    invitation: "View invitation",
    invitation_answered: "View team",
    task_submitted: "Review",
};
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
        let joined = false;
        // A fresh name per mount: supabase-js hands back a same-named channel that is still leaving, which never rejoins.
        const channel = sb
            .channel(`work-notifications:${userId}:${Math.random().toString(36).slice(2, 8)}`)
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
                action: { label: ACTION_LABEL[row.kind] ?? "Open task", onClick: () => router.push(row.href) },
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
        });
        // Rejoining after a dropped connection (a phone waking up): catch up on what arrived meanwhile.
        subscribeAsViewer(sb, channel, (status) => {
            if (status !== "SUBSCRIBED")
                return;
            if (joined)
                void refresh();
            joined = true;
        });
        const catchUp = () => {
            if (document.visibilityState === "visible")
                void refresh();
        };
        document.addEventListener("visibilitychange", catchUp);
        window.addEventListener("online", catchUp);
        return () => {
            document.removeEventListener("visibilitychange", catchUp);
            window.removeEventListener("online", catchUp);
            void sb.removeChannel(channel);
        };
    }, [router, userId, refresh]);
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
