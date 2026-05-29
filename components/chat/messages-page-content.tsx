"use client";
import type { ChatMessage, ChatMessageAttachment, Profile, ProjectChatReadCursor } from "@/types/database";
import type { ChatParticipant } from "@/services/chat-presence-service";
import { MessageRoom } from "./message-room";
export function MessagesPageContent({ projectId, initialMessages, initialAttachments, viewerProfile, senderProfiles, participants, initialReadCursors, defaultShowMedia, }: {
    projectId: string;
    initialMessages: ChatMessage[];
    initialAttachments: ChatMessageAttachment[];
    viewerProfile: Pick<Profile, "id" | "full_name" | "avatar_url">;
    senderProfiles: Record<string, Pick<Profile, "id" | "full_name" | "avatar_url">>;
    participants: ChatParticipant[];
    initialReadCursors: ProjectChatReadCursor[];
    defaultShowMedia?: boolean;
}) {
    return (<div className="flex min-h-0 flex-1 flex-col">
      <MessageRoom projectId={projectId} initialMessages={initialMessages} initialAttachments={initialAttachments} viewerProfile={viewerProfile} senderProfiles={senderProfiles} participants={participants} initialReadCursors={initialReadCursors} defaultShowMedia={defaultShowMedia} className="min-h-0 flex-1"/>
    </div>);
}
