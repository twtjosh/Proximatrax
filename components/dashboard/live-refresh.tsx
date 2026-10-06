"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Re-renders the surrounding server page whenever a task, milestone or
 * project the viewer can see changes (RLS scopes the realtime stream), so
 * submitted work and delivered milestones show up without a manual reload.
 */
export function LiveRefresh({ channel }: {
    channel: string;
}) {
    const router = useRouter();
    React.useEffect(() => {
        const sb = createClient();
        let timer: ReturnType<typeof setTimeout> | undefined;
        // A drag across stages fires several writes; refresh once.
        const refresh = () => {
            clearTimeout(timer);
            timer = setTimeout(() => router.refresh(), 500);
        };
        const subscription = sb.channel(channel);
        for (const table of ["tasks", "milestones", "projects"])
            subscription.on("postgres_changes", { event: "*", schema: "public", table }, refresh);
        subscription.subscribe();
        return () => {
            clearTimeout(timer);
            void sb.removeChannel(subscription);
        };
    }, [channel, router]);
    return null;
}
