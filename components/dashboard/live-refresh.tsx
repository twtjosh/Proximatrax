"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { projectPath, projectReviewPath } from "@/lib/constants";
import { isOwnMove, taskAnnouncement, type LiveTaskRow } from "@/lib/live-changes";
import { createClient } from "@/lib/supabase/client";

/** Everything a task surface draws from: the work, its proof, its talk, its phase and its people. */
const TABLES = ["tasks", "task_attachments", "task_comments", "milestones", "projects", "project_members"] as const;
/** Back after this long in a hidden tab, the socket may have slept through changes. */
const STALE_MS = 30_000;

/**
 * Re-renders the surrounding server page whenever work the viewer can see
 * changes (RLS scopes the stream), so submitted work, decisions, photos and
 * comments show up without a reload. With `projectId` it listens to that
 * project only. With `announce` it also toasts the moments people wait on:
 * a PM hears about new submissions, crew hear the PM's decision on theirs.
 *
 * Each table gets its own channel: Realtime rejects a channel's whole
 * postgres_changes subscription when any one table isn't published, which
 * once left every task update undelivered.
 */
export function LiveRefresh({ channel, projectId, announce, viewerId }: {
    channel: string;
    projectId?: string;
    announce?: "pm" | "crew";
    /** Whose work counts as "theirs" for crew announcements. */
    viewerId?: string;
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
        const audience = announce === "pm" ? { role: "pm" as const } : announce === "crew" && viewerId ? { role: "crew" as const, viewerId } : null;
        const onTask = (payload: RealtimePostgresChangesPayload<LiveTaskRow>) => {
            refresh();
            if (!audience || payload.eventType !== "UPDATE" || isOwnMove(payload.new.id))
                return;
            const said = taskAnnouncement(payload.old, payload.new, audience);
            if (!said)
                return;
            const { id, project_id, title } = said.task;
            if (said.kind === "submitted")
                toast("Submitted for review", { description: title, duration: 10_000, action: { label: "Review", onClick: () => router.push(`${projectReviewPath(project_id)}?task=${id}`) } });
            else if (said.kind === "accepted")
                toast.success("Your work was accepted", { description: title, duration: 8_000, action: { label: "View", onClick: () => router.push(`${projectPath(project_id)}?task=${id}`) } });
            else
                toast.warning("Sent back for changes", { description: title, duration: 10_000, action: { label: "Open task", onClick: () => router.push(`${projectPath(project_id)}?task=${id}`) } });
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
            ch.subscribe((status) => {
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
    }, [channel, projectId, announce, viewerId, router]);
    return null;
}
