"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { revalidateInquiryShellAction } from "@/app/(dashboard)/inquiries/shell-actions";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
const DEBOUNCE_MS = 400;
const POLL_MS = 10000;
type InquiryShellRealtimeSubscriberProps = {
    profileId: string;
};
export function InquiryShellRealtimeSubscriber({ profileId, }: InquiryShellRealtimeSubscriberProps) {
    const router = useRouter();
    const timerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const flushingRef = React.useRef(false);
    const flushShell = React.useCallback(async () => {
        if (flushingRef.current)
            return;
        flushingRef.current = true;
        try {
            await revalidateInquiryShellAction();
            router.refresh();
        }
        finally {
            flushingRef.current = false;
        }
    }, [router]);
    const scheduleFlush = React.useCallback(() => {
        if (timerRef.current)
            clearTimeout(timerRef.current);
        timerRef.current = setTimeout(() => {
            timerRef.current = null;
            void flushShell();
        }, DEBOUNCE_MS);
    }, [flushShell]);
    React.useEffect(() => {
        const sb = createClient();
        const channelName = `inquiry-shell:${profileId}`;
        removeRealtimeChannelByName(sb, channelName);
        const channel = sb
            .channel(channelName)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "inquiries" }, scheduleFlush)
            .on("postgres_changes", { event: "UPDATE", schema: "public", table: "inquiries" }, scheduleFlush)
            .on("postgres_changes", {
            event: "*",
            schema: "public",
            table: "inquiry_views",
            filter: `profile_id=eq.${profileId}`,
        }, scheduleFlush)
            .subscribe();
        const poll = window.setInterval(() => {
            if (document.visibilityState === "visible") {
                void flushShell();
            }
        }, POLL_MS);
        return () => {
            if (timerRef.current)
                clearTimeout(timerRef.current);
            window.clearInterval(poll);
            void sb.removeChannel(channel);
        };
    }, [profileId, scheduleFlush, flushShell]);
    return null;
}
