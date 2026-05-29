"use client";
import * as React from "react";
import { CheckCheck, Paperclip, X } from "lucide-react";
import { useProjectWorkspace } from "@/components/projects/project-workspace-context";
import { Button } from "@/components/ui/button";
import { usersSeenUpToLatest } from "@/hooks/use-project-chat-realtime";
import { cn } from "@/lib/utils";
import type { ChatParticipant } from "@/services/chat-presence-service";
import type { ChatMessage, ChatMessageAttachment, Profile, ProjectChatReadCursor } from "@/types/database";
import { ChannelMediaPanel } from "./channel-media-panel";
import { ChatWindow } from "./chat-window";
export type MessageRoomProps = {
    projectId: string;
    initialMessages: ChatMessage[];
    initialAttachments: ChatMessageAttachment[];
    viewerProfile: Pick<Profile, "id" | "full_name" | "avatar_url">;
    senderProfiles: Record<string, Pick<Profile, "id" | "full_name" | "avatar_url">>;
    participants: ChatParticipant[];
    initialReadCursors: ProjectChatReadCursor[];
    defaultShowMedia?: boolean;
    className?: string;
};
type RoomView = "chat" | "media";
export function MessageRoom({ projectId, initialMessages, initialAttachments, viewerProfile, senderProfiles, participants, initialReadCursors, defaultShowMedia = false, className, }: MessageRoomProps) {
    const workspace = useProjectWorkspace();
    const fillsWorkspace = Boolean(workspace);
    const [mobileView, setMobileView] = React.useState<RoomView>(defaultShowMedia ? "media" : "chat");
    const [mediaPanelOpen, setMediaPanelOpen] = React.useState(defaultShowMedia);
    const [attachments, setAttachments] = React.useState<ChatMessageAttachment[]>(initialAttachments);
    const [liveMessages, setLiveMessages] = React.useState<ChatMessage[]>(initialMessages);
    const [liveReadCursors, setLiveReadCursors] = React.useState<ProjectChatReadCursor[]>(initialReadCursors);
    React.useEffect(() => {
        setAttachments(initialAttachments);
    }, [initialAttachments]);
    React.useEffect(() => {
        setLiveMessages(initialMessages);
    }, [initialMessages]);
    React.useEffect(() => {
        setLiveReadCursors(initialReadCursors);
    }, [initialReadCursors]);
    const mediaCount = attachments.length;
    const latestMessage = liveMessages.at(-1);
    const seenInRoom = usersSeenUpToLatest(latestMessage, liveReadCursors, participants, viewerProfile.id);
    function openMediaPanel() {
        setMediaPanelOpen(true);
        setMobileView("media");
    }
    function closeMediaPanel() {
        setMediaPanelOpen(false);
        setMobileView("chat");
    }
    return (<section className={cn("flex min-h-0 flex-col overflow-hidden rounded-lg border border-slate-200 bg-white", fillsWorkspace ? "h-full flex-1" : "min-h-[min(70vh,640px)]", className)} aria-label="Project messages">
      <header className="flex shrink-0 items-center justify-between gap-3 border-b border-slate-200 px-4 py-3">
        <div className="min-w-0">
          <h2 className="font-heading text-base font-medium tracking-tight text-slate-950">
            Conversation
          </h2>
          <p className="text-xs text-slate-500">Project team chat · live</p>
          {latestMessage && seenInRoom.length > 0 ? (<p className="mt-0.5 flex items-center gap-1 text-[11px] text-slate-500">
              <CheckCheck className="h-3 w-3 text-[#9a4f02]" aria-hidden/>
              Seen by {seenInRoom.map((u) => u.full_name.split(" ")[0]).join(", ")}
            </p>) : null}
        </div>

        <div className="flex shrink-0 items-center gap-2">
          <Button type="button" variant={mediaPanelOpen ? "secondary" : "outline"} size="sm" onClick={() => (mediaPanelOpen ? closeMediaPanel() : openMediaPanel())} className="h-8 gap-1.5 text-xs" aria-expanded={mediaPanelOpen}>
            <Paperclip className="h-3.5 w-3.5" aria-hidden/>
            <span className="hidden sm:inline">Shared files</span>
            <span className="sm:hidden">Files</span>
            {mediaCount > 0 ? (<span className="rounded-full bg-slate-200/80 px-1.5 py-0.5 text-[10px] font-medium tabular-nums text-slate-700">
                {mediaCount}
              </span>) : null}
          </Button>
        </div>
      </header>

      
      <div className="flex shrink-0 border-b border-slate-200 lg:hidden">
        <MobilePaneTab active={mobileView === "chat"} label="Chat" onClick={() => setMobileView("chat")}/>
        <MobilePaneTab active={mobileView === "media"} label={`Files${mediaCount > 0 ? ` (${mediaCount})` : ""}`} onClick={() => {
            setMobileView("media");
            setMediaPanelOpen(true);
        }}/>
      </div>

      <div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", mediaPanelOpen &&
            "lg:grid lg:min-h-0 lg:grid-cols-[minmax(0,1fr)_280px] lg:grid-rows-1 lg:overflow-hidden")}>
        <div className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden", mobileView !== "chat" && "max-lg:hidden")}>
          <ChatWindow projectId={projectId} initialMessages={initialMessages} initialAttachments={attachments} viewerProfile={viewerProfile} senderProfiles={senderProfiles} participants={participants} initialReadCursors={initialReadCursors} onAttachmentsChange={setAttachments} onLiveStateChange={({ messages, readCursors }) => {
            setLiveMessages(messages);
            setLiveReadCursors(readCursors);
        }} embedded onOpenMedia={openMediaPanel}/>
        </div>

        {mediaPanelOpen ? (<aside className={cn("flex min-h-0 flex-col overflow-hidden border-slate-200 bg-slate-50/50 lg:border-l", mobileView !== "media" && "max-lg:hidden")}>
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 bg-white px-4 py-2.5 lg:hidden">
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">Shared files</p>
                <p className="text-xs text-slate-500">From this conversation</p>
              </div>
              <Button type="button" variant="ghost" size="icon" onClick={closeMediaPanel} className="h-8 w-8 shrink-0 text-slate-500" aria-label="Close shared files">
                <X className="h-4 w-4"/>
              </Button>
            </div>
            <ChannelMediaPanel attachments={attachments} embedded onUploadClick={() => setMobileView("chat")} className="min-h-0 flex-1"/>
          </aside>) : null}
      </div>
    </section>);
}
function MobilePaneTab({ active, label, onClick, }: {
    active: boolean;
    label: string;
    onClick: () => void;
}) {
    return (<button type="button" onClick={onClick} className={cn("flex-1 py-2.5 text-sm font-medium transition-colors", active
            ? "border-b-2 border-[#d97706] text-[#9a4f02]"
            : "text-slate-500 hover:text-slate-800")}>
      {label}
    </button>);
}
