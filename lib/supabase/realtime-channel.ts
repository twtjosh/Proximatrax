import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
function channelMatchesName(ch: RealtimeChannel, channelName: string): boolean {
    const topic = ch.topic ?? "";
    return (topic === channelName ||
        topic === `realtime:${channelName}` ||
        topic.endsWith(`:${channelName}`));
}
export function removeRealtimeChannelByName(sb: SupabaseClient, channelName: string) {
    for (const ch of sb.getChannels()) {
        if (!channelMatchesName(ch, channelName))
            continue;
        void ch.unsubscribe();
        void sb.removeChannel(ch);
    }
}
