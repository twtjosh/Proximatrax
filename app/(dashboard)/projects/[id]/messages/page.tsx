import { notFound, redirect } from "next/navigation";
import { MessagesPageContent } from "@/components/chat/messages-page-content";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { listProjectChatAttachments } from "@/services/chat-attachment-service";
import { listProjectChatParticipants, listProjectChatReadCursors, } from "@/services/chat-presence-service";
import { listChatMessages } from "@/services/chat-service";
import type { Profile } from "@/types/database";
export default async function ProjectMessagesPage(props: {
    params: Promise<{
        id: string;
    }>;
    searchParams: Promise<{
        media?: string;
    }>;
}) {
    const { id } = await props.params;
    const { media } = await props.searchParams;
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("id, full_name, avatar_url, role")
        .eq("id", user.id)
        .maybeSingle();
    const viewer = profile as Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> | null;
    if (!viewer)
        notFound();
    const [messages, attachments, participants, readCursors] = await Promise.all([
        listChatMessages(id, 200, supabase),
        listProjectChatAttachments(id, supabase),
        listProjectChatParticipants(id, supabase),
        listProjectChatReadCursors(id, supabase),
    ]);
    const senderIds = [...new Set(messages.map((m) => m.sender_id))];
    let senderMap: Record<string, Pick<Profile, "id" | "full_name" | "avatar_url">> = {};
    if (senderIds.length > 0) {
        const { data: senders } = await supabase
            .from("profiles")
            .select("id, full_name, avatar_url")
            .in("id", senderIds);
        senderMap = Object.fromEntries((senders ?? []).map((s) => [s.id, s as Pick<Profile, "id" | "full_name" | "avatar_url">]));
    }
    for (const participant of participants) {
        senderMap[participant.id] = participant;
    }
    return (<MessagesPageContent projectId={id} initialMessages={messages} initialAttachments={attachments} viewerProfile={viewer} senderProfiles={senderMap} participants={participants} initialReadCursors={readCursors} defaultShowMedia={media === "1" || media === "true"}/>);
}
