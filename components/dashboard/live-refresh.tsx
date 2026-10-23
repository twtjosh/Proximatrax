"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { isOwnChange, type LiveTaskRow } from "@/lib/live-changes";
import { createClient, subscribeAsViewer } from "@/lib/supabase/client";

/** Everything a task surface draws from: the work, its proof, its talk, its phase, its people and who is invited. */
const TABLES = ["tasks", "task_attachments", "task_comments", "milestones", "projects", "project_members", "project_invitations"] as const;
/** Back after this long in a hidden tab, the socket may have slept through changes. */
const STALE_MS = 30_000;

/**
 * Re-renders the surrounding server page whenever work the viewer can see
 * changes (RLS scopes the stream), so submitted work, decisions, photos,
 * comments and invitations show up without a reload. With `projectId` it
 * listens to that project only. The moments people wait on (a submission, a
 * decision, an answered invitation) are announced by the notification bell.
 *
 * Each table gets its own channel: Realtime rejects a channel's whole
 * postgres_changes subscription when any one table isn't published, which
 * once left every task update undelivered.
 */
export function LiveRefresh({ channel, projectId }: {
    channel: string;
    projectId?: string;
}) {
    const router = useRouter();
    React.useEffect(() => {
        const sb = createClient();
        let timer: ReturnType<typeof setTimeout> | undefined;
        // A drag across stages fires several writes; refresh once.
        const refresh = () => {
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 400);
        };
        const onTask = (payload: RealtimePostgresChangesPayload<LiveTaskRow>) => {
            // The echo of this browser's own write: the writer already updated its view (and refreshes when it needs to).
            if (payload.eventType !== "DELETE" && isOwnChange(payload.new.id))
                return;
            refresh();
        };

        // A fresh name per mount: supabase-js hands back a same-named channel that is still leaving, which never rejoins.
        const mount = Math.random().toString(36).slice(2, 8);
        const channels = TABLES.map((table) => {
            const filter = projectId ? (table === "projects" ? `id=eq.${projectId}` : `project_id=eq.${projectId}`) : undefined;
            const ch = sb.channel(`${channel}:${table}:${mount}`);
            if (table === "tasks") {
                ch.on("postgres_changes", { event: "*", schema: "public", table, filter }, onTask);
                // Deletes can't be filtered, so a scoped view listens for all of them.
                if (filter)
                    ch.on("postgres_changes", { event: "DELETE", schema: "public", table }, refresh);
            }
            else
                ch.on("postgres_changes", { event: "*", schema: "public", table, filter }, refresh);
            // Rejoining after a dropped connection: catch up on whatever happened meanwhile.
            let joined = false;
            subscribeAsViewer(sb, ch, (status) => {
                if (status !== "SUBSCRIBED")
                    return;
                if (joined && table === "tasks")
                    refresh();
                joined = true;
            });
            return ch;
        });

        let hiddenAt = 0;
        const onVisibility = () => {
            if (document.visibilityState === "hidden")
                hiddenAt = Date.now();
            else if (hiddenAt && Date.now() - hiddenAt > STALE_MS)
                refresh();
        };
        document.addEventListener("visibilitychange", onVisibility);
        return () => {
            clearTimeout(timer);
            document.removeEventListener("visibilitychange", onVisibility);
            for (const ch of channels)
                void sb.removeChannel(ch);
        };
    }, [channel, projectId, router]);
    return null;
}
