"use client";
import * as React from "react";
import Link from "next/link";
import { ChevronLeft, Loader2, Minus, Paperclip } from "lucide-react";
import { ChannelMediaPanel } from "@/components/chat/channel-media-panel";
import { ChatWindow } from "@/components/chat/chat-window";
import { Face, FaceStack, focusRing } from "@/components/dashboard/overview-kit";
import { projectPath } from "@/lib/constants";
import type { InboxItem } from "@/lib/messenger";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";
import { listProjectChatAttachments } from "@/services/chat-attachment-service";
import { listProjectChatParticipants, listProjectChatReadCursors, type ChatParticipant } from "@/services/chat-presence-service";
import { listChatMessages } from "@/services/chat-service";
import type { ChatMessage, ChatMessageAttachment, ProjectChatReadCursor } from "@/types/database";
import { useMessenger } from "./messenger-store";

const HISTORY = 200;

type Room = {
    messages: ChatMessage[];
    attachments: ChatMessageAttachment[];
    participants: ChatParticipant[];
    readCursors: ProjectChatReadCursor[];
    senders: Record<string, ChatParticipant>;
};

export function PanelIconButton({ label, onClick, pressed, children }: {
    label: string;
    onClick: () => void;
    pressed?: boolean;
    children: React.ReactNode;
}) {
    return (<button type="button" onClick={onClick} aria-label={label} aria-pressed={pressed} className={cn("inline-flex h-8 min-w-8 shrink-0 cursor-pointer items-center justify-center gap-1 rounded-full px-2 text-ink-secondary transition-colors hover:bg-surface-sunken hover:text-ink [&_svg]:size-4", pressed && "bg-brand-soft text-brand hover:bg-brand-soft hover:text-brand", focusRing)}>
      {children}
    </button>);
}

/** The project's people, or its initial when the viewer is the only one named. */
export function ProjectFaces({ project, size = 32 }: {
    project: InboxItem;
    size?: number;
}) {
    return project.people.length > 0
        ? <FaceStack people={project.people} max={2} size={size}/>
        : <Face person={{ id: project.id, name: project.title, avatarUrl: null, role: "" }} size={size}/>;
}

/** One project room inside the messenger panel. */
export function Conversation({ project, viewer, onBack, onMinimize }: {
    project: InboxItem;
    viewer: ChatParticipant;
    onBack: () => void;
    onMinimize: () => void;
}) {
    const draft = useMessenger((s) => s.drafts[project.id] ?? "");
    const setDraft = useMessenger((s) => s.setDraft);
    const [room, setRoom] = React.useState<Room | null>(null);
    const [attachments, setAttachments] = React.useState<ChatMessageAttachment[]>([]);
    const [failed, setFailed] = React.useState(false);
    const [view, setView] = React.useState<"chat" | "files">("chat");

    const load = React.useCallback(async () => {
        try {
            const [messages, files, participants, readCursors] = await Promise.all([
                listChatMessages(project.id, HISTORY),
                listProjectChatAttachments(project.id),
                listProjectChatParticipants(project.id),
                listProjectChatReadCursors(project.id),
            ]);
            const senders: Record<string, ChatParticipant> = Object.fromEntries(participants.map((p) => [p.id, p]));
            // Former members still have messages in the history.
            const missing = [...new Set(messages.map((m) => m.sender_id))].filter((id) => !senders[id]);
            if (missing.length > 0) {
                const { data } = await createClient().from("profiles").select("id, full_name, avatar_url").in("id", missing);
                for (const s of (data ?? []) as ChatParticipant[])
                    senders[s.id] = s;
            }
            setAttachments(files);
            setRoom({ messages, attachments: files, participants, readCursors, senders });
        }
        catch {
            setFailed(true);
        }
    }, [project.id]);

    React.useEffect(() => {
        void load();
    }, [load]);

    return (<div className="flex min-h-0 flex-1 flex-col">
      <header className="flex shrink-0 items-center gap-2 border-b border-line py-2 pr-2 pl-1.5">
        <PanelIconButton label="All conversations" onClick={onBack}><ChevronLeft/></PanelIconButton>
        <ProjectFaces project={project} size={28}/>
        <Link href={projectPath(project.id)} onClick={onMinimize} className={cn("min-w-0 flex-1 truncate rounded-sm text-sm font-semibold text-ink hover:text-brand", focusRing)}>
          {project.title}
        </Link>
        <PanelIconButton label={view === "files" ? "Back to chat" : "Shared files"} pressed={view === "files"} onClick={() => setView((v) => (v === "files" ? "chat" : "files"))}>
          <Paperclip/>
          {attachments.length > 0 ? <span className="text-xs font-medium tabular">{attachments.length}</span> : null}
        </PanelIconButton>
        <PanelIconButton label="Minimize" onClick={onMinimize}><Minus/></PanelIconButton>
      </header>

      {failed ? (<div className="grid flex-1 place-items-center p-6 text-center">
          <div>
            <p className="text-sm text-ink-secondary">This conversation couldn&apos;t load.</p>
            <button type="button" onClick={() => { setFailed(false); void load(); }} className={cn("mt-3 cursor-pointer rounded-full bg-surface-sunken px-4 py-1.5 text-sm font-medium text-ink hover:bg-line", focusRing)}>Retry</button>
          </div>
        </div>) : !room ? (<div className="grid flex-1 place-items-center" role="status" aria-label="Loading conversation">
          <Loader2 className="size-5 animate-spin text-ink-tertiary" aria-hidden/>
        </div>) : (<div className="relative flex min-h-0 flex-1 flex-col">
          {/* Chat stays mounted under Files so its live updates keep flowing. */}
          <div className={cn("flex min-h-0 flex-1 flex-col", view === "files" && "invisible")} aria-hidden={view === "files"}>
            <ChatWindow projectId={project.id} initialMessages={room.messages} initialAttachments={room.attachments} viewerProfile={viewer} senderProfiles={room.senders} participants={room.participants} initialReadCursors={room.readCursors} onAttachmentsChange={setAttachments} draft={draft} onDraftChange={(text) => setDraft(project.id, text)}/>
          </div>
          {view === "files" ? <ChannelMediaPanel attachments={attachments} className="absolute inset-0"/> : null}
        </div>)}
    </div>);
}
