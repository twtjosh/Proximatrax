"use client";
import * as React from "react";
import { CheckCheck, ImageIcon, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useProjectWorkspace } from "@/components/projects/project-workspace-context";
import { formatTypingLabel, useProjectChatRealtime, usersWhoSeenMessage, } from "@/hooks/use-project-chat-realtime";
import { cn } from "@/lib/utils";
import { publicAttachmentUrl, uploadChatAttachment, } from "@/services/chat-attachment-service";
import type { ChatParticipant } from "@/services/chat-presence-service";
import { sendChatMessage } from "@/services/chat-service";
import type { ChatMessage, ChatMessageAttachment, Profile, ProjectChatReadCursor, } from "@/types/database";
const TYPING_IDLE_MS = 2000;
function initials(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
export type ChatWindowProps = {
    projectId: string;
    initialMessages: ChatMessage[];
    initialAttachments: ChatMessageAttachment[];
    viewerProfile: Pick<Profile, "id" | "full_name" | "avatar_url">;
    senderProfiles: Record<string, Pick<Profile, "id" | "full_name" | "avatar_url">>;
    participants: ChatParticipant[];
    initialReadCursors: ProjectChatReadCursor[];
    onAttachmentsChange?: (attachments: ChatMessageAttachment[]) => void;
    onLiveStateChange?: (state: {
        messages: ChatMessage[];
        readCursors: ProjectChatReadCursor[];
    }) => void;
    embedded?: boolean;
    onOpenMedia?: () => void;
};
export function ChatWindow({ projectId, initialMessages, initialAttachments, viewerProfile, senderProfiles, participants, initialReadCursors, onAttachmentsChange, onLiveStateChange, embedded = false, onOpenMedia, }: ChatWindowProps) {
    const workspace = useProjectWorkspace();
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const [draft, setDraft] = React.useState("");
    const [sending, setSending] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const bottomRef = React.useRef<HTMLDivElement>(null);
    const typingIdleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = React.useRef(false);
    const { messages, attachments, senders, readCursors, typingUsers, pushMessage, pushAttachment, broadcastTyping, } = useProjectChatRealtime({
        projectId,
        viewerId: viewerProfile.id,
        initialMessages,
        initialAttachments,
        senderProfiles,
        participants,
        initialReadCursors,
        onAttachmentsChange,
    });
    const attachmentsByMessage = React.useMemo(() => {
        const map = new Map<string, ChatMessageAttachment[]>();
        for (const item of attachments) {
            const list = map.get(item.message_id) ?? [];
            list.push(item);
            map.set(item.message_id, list);
        }
        return map;
    }, [attachments]);
    const recentPhotos = React.useMemo(() => attachments.filter((a) => a.media_kind === "photo").slice(0, 4), [attachments]);
    const lastOwnMessageId = React.useMemo(() => {
        for (let i = messages.length - 1; i >= 0; i -= 1) {
            if (messages[i].sender_id === viewerProfile.id)
                return messages[i].id;
        }
        return null;
    }, [messages, viewerProfile.id]);
    const typingLabel = formatTypingLabel(typingUsers);
    React.useEffect(() => {
        onLiveStateChange?.({ messages, readCursors });
    }, [messages, readCursors, onLiveStateChange]);
    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ behavior: "smooth" });
    }, [messages, attachments, typingLabel]);
    const stopTyping = React.useCallback(() => {
        if (typingIdleRef.current) {
            clearTimeout(typingIdleRef.current);
            typingIdleRef.current = null;
        }
        if (isTypingRef.current) {
            isTypingRef.current = false;
            broadcastTyping(false);
        }
    }, [broadcastTyping]);
    const handleDraftChange = React.useCallback((value: string) => {
        setDraft(value);
        if (!value.trim()) {
            stopTyping();
            return;
        }
        if (!isTypingRef.current) {
            isTypingRef.current = true;
            broadcastTyping(true);
        }
        if (typingIdleRef.current)
            clearTimeout(typingIdleRef.current);
        typingIdleRef.current = setTimeout(() => {
            typingIdleRef.current = null;
            stopTyping();
        }, TYPING_IDLE_MS);
    }, [broadcastTyping, stopTyping]);
    React.useEffect(() => () => stopTyping(), [stopTyping]);
    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        const text = draft.trim();
        if (!text || sending)
            return;
        stopTyping();
        setSending(true);
        try {
            const msg = await sendChatMessage(projectId, text);
            setDraft("");
            pushMessage(msg);
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Message not sent.");
        }
        finally {
            setSending(false);
        }
    }
    async function handleFilePick(e: React.ChangeEvent<HTMLInputElement>) {
        const file = e.target.files?.[0];
        e.target.value = "";
        if (!file || uploading)
            return;
        setUploading(true);
        try {
            const { attachment } = await uploadChatAttachment(projectId, file);
            pushAttachment(attachment);
            pushMessage({
                id: attachment.message_id,
                project_id: projectId,
                sender_id: viewerProfile.id,
                content: file.name,
                created_at: attachment.created_at,
            });
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed.");
        }
        finally {
            setUploading(false);
        }
    }
    return (<div className={cn("flex min-h-0 flex-1 flex-col overflow-hidden", !workspace && "min-h-[min(70vh,640px)] lg:min-h-0", !embedded && "border border-slate-200 bg-white")}>
      {recentPhotos.length > 0 && onOpenMedia ? (<button type="button" onClick={onOpenMedia} className="flex items-center gap-3 border-b border-slate-200/80 bg-white px-4 py-2.5 text-left transition-colors hover:bg-slate-50 lg:hidden">
          <div className="flex -space-x-2">
            {recentPhotos.map((p) => (<img key={p.id} src={publicAttachmentUrl(p.storage_path)} alt="" className="h-9 w-9 border-2 border-white object-cover"/>))}
          </div>
          <span className="text-xs text-slate-600">
            <span className="font-medium text-slate-900">{attachments.length}</span> shared
            · tap to browse
          </span>
          <ImageIcon className="ml-auto h-4 w-4 text-[#d97706]"/>
        </button>) : null}

      <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-4 py-4">
        {messages.length === 0 ? (<ChatEmptyState onAttach={() => fileInputRef.current?.click()}/>) : (messages.map((m) => {
            const who = senders[m.sender_id];
            const mine = m.sender_id === viewerProfile.id;
            const messageAttachments = attachmentsByMessage.get(m.id) ?? [];
            const seenBy = mine && m.id === lastOwnMessageId
                ? usersWhoSeenMessage(m, readCursors, participants, viewerProfile.id)
                : [];
            return (<MessageBubbleRow key={m.id} mine={mine} who={who} message={m} attachments={messageAttachments} seenBy={seenBy}/>);
        }))}
        {typingLabel ? <TypingIndicator label={typingLabel}/> : null}
        <ChatBottomAnchor ref={bottomRef}/>
      </div>

      <form onSubmit={(e) => void handleSend(e)} className="shrink-0 border-t border-slate-200 bg-white p-3">
        <div className="flex items-end gap-2 rounded-sm border border-slate-200 bg-slate-50/80 p-1.5 shadow-inner">
          <input ref={fileInputRef} type="file" className="sr-only" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(e) => void handleFilePick(e)}/>
          <Button type="button" variant="ghost" size="icon" disabled={uploading || sending} onClick={() => fileInputRef.current?.click()} className="h-9 w-9 shrink-0 rounded-sm text-slate-500 hover:bg-white hover:text-[#9a4f02]" aria-label="Attach file">
            {uploading ? (<Loader2 className="h-4 w-4 animate-spin"/>) : (<Paperclip className="h-4 w-4"/>)}
          </Button>
          <Input value={draft} onChange={(e) => handleDraftChange(e.target.value)} placeholder="Message the project team…" className="min-h-9 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0" maxLength={4000}/>
          <Button type="submit" disabled={sending || uploading || !draft.trim()} size="icon" className="h-9 w-9 shrink-0 rounded-sm bg-[#d97706] text-slate-950 hover:bg-[#ef9b27]" aria-label="Send message">
            {sending ? (<Loader2 className="h-4 w-4 animate-spin"/>) : (<Send className="h-4 w-4"/>)}
          </Button>
        </div>
        <p className="mt-2 text-center font-mono text-[9px] uppercase tracking-[0.14em] text-slate-400">
          Attach photos, videos, or documents · visible in shared media
        </p>
      </form>
    </div>);
}
const ChatBottomAnchor = React.forwardRef<HTMLDivElement>(function ChatBottomAnchor(_, ref) {
    return <div ref={ref}/>;
});
function TypingIndicator({ label }: {
    label: string;
}) {
    return (<div className="flex items-center gap-2 px-1 text-xs text-slate-500" aria-live="polite">
      <span className="flex gap-0.5">
        {[0, 1, 2].map((i) => (<span key={i} className="inline-block h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" style={{ animationDelay: `${i * 150}ms` }}/>))}
      </span>
      {label}
    </div>);
}
function ChatEmptyState({ onAttach }: {
    onAttach: () => void;
}) {
    return (<div className="flex flex-col items-center justify-center gap-4 py-16 text-center">
      <div className="flex h-14 w-14 items-center justify-center border border-dashed border-slate-300 bg-slate-50">
        <Send className="h-6 w-6 text-slate-400" aria-hidden/>
      </div>
      <div className="max-w-xs space-y-1">
        <p className="font-heading text-base tracking-tight text-slate-900">
          Start the thread
        </p>
        <p className="text-sm text-slate-500">
          Post updates for the PM, field team, and client. Anything you attach appears in shared
          media too.
        </p>
      </div>
      <Button type="button" variant="outline" size="sm" onClick={onAttach} className="rounded-none border-slate-200 font-mono text-[10px] uppercase tracking-[0.12em]">
        <Paperclip className="mr-1.5 h-3.5 w-3.5"/>
        Share a file
      </Button>
    </div>);
}
function MessageBubbleRow({ mine, who, message, attachments, seenBy, }: {
    mine: boolean;
    who?: Pick<Profile, "id" | "full_name" | "avatar_url">;
    message: ChatMessage;
    attachments: ChatMessageAttachment[];
    seenBy: ChatParticipant[];
}) {
    const hasOnlyAttachment = attachments.length > 0 &&
        message.content === attachments[0]?.file_name;
    return (<div className={cn("flex gap-2.5", mine ? "flex-row-reverse" : "flex-row")}>
      <Avatar className="mt-1 h-8 w-8 shrink-0 rounded-sm border border-slate-200 shadow-sm">
        {who?.avatar_url ? <AvatarImage src={who.avatar_url} alt=""/> : null}
        <AvatarFallback className="rounded-sm bg-slate-800 text-[10px] text-white">
          {initials(who?.full_name ?? "?")}
        </AvatarFallback>
      </Avatar>
      <BubbleBody mine={mine} who={who} message={message} attachments={attachments} hasOnlyAttachment={hasOnlyAttachment} seenBy={seenBy}/>
    </div>);
}
function BubbleBody({ mine, who, message, attachments, hasOnlyAttachment, seenBy, }: {
    mine: boolean;
    who?: Pick<Profile, "id" | "full_name" | "avatar_url">;
    message: ChatMessage;
    attachments: ChatMessageAttachment[];
    hasOnlyAttachment: boolean;
    seenBy: ChatParticipant[];
}) {
    return (<div className={cn("max-w-[min(100%,32rem)] overflow-hidden rounded-sm shadow-sm", mine
            ? "rounded-br-none border border-[#d97706]/25 bg-gradient-to-br from-[#fff8ef] to-[#ffedd5]/80"
            : "rounded-bl-none border border-slate-200 bg-white")}>
      {!mine ? (<p className="border-b border-slate-100 px-3 py-1.5 font-mono text-[10px] uppercase tracking-[0.14em] text-slate-500">
          {who?.full_name ?? "Member"}
        </p>) : null}
      {attachments.length > 0 ? (<AttachmentList attachments={attachments}/>) : null}
      {!hasOnlyAttachment ? (<p className="whitespace-pre-wrap px-3 py-2 text-sm leading-relaxed text-slate-900">
          {message.content}
        </p>) : null}
      <div className={cn("flex items-center gap-2 px-3 pb-2", attachments.length > 0 && hasOnlyAttachment && "pt-0")}>
        <p className="font-mono text-[10px] text-slate-400">
          {new Date(message.created_at).toLocaleString(undefined, {
            month: "short",
            day: "numeric",
            hour: "2-digit",
            minute: "2-digit",
        })}
        </p>
        {mine && seenBy.length > 0 ? (<span className="ml-auto flex items-center gap-1 font-mono text-[10px] text-[#9a4f02]">
            <CheckCheck className="h-3 w-3" aria-hidden/>
            Seen by {seenBy.map((u) => u.full_name.split(" ")[0]).join(", ")}
          </span>) : null}
      </div>
    </div>);
}
function AttachmentList({ attachments }: {
    attachments: ChatMessageAttachment[];
}) {
    return (<div className="space-y-0.5 p-1">
      {attachments.map((item) => (<MessageAttachmentPreview key={item.id} item={item}/>))}
    </div>);
}
function MessageAttachmentPreview({ item }: {
    item: ChatMessageAttachment;
}) {
    const url = publicAttachmentUrl(item.storage_path);
    if (item.media_kind === "photo") {
        return (<a href={url} target="_blank" rel="noopener noreferrer" className="block overflow-hidden rounded-sm">
        
        <img src={url} alt={item.file_name} className="max-h-56 w-full object-cover"/>
      </a>);
    }
    if (item.media_kind === "video") {
        return (<video src={url} controls preload="metadata" className="max-h-56 w-full rounded-sm bg-black"/>);
    }
    return (<a href={url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 rounded-sm border border-slate-200/80 bg-white px-2.5 py-2 text-xs hover:border-[#d97706]/30">
      <Paperclip className="h-3.5 w-3.5 shrink-0 text-[#d97706]"/>
      <span className="truncate font-medium">{item.file_name}</span>
    </a>);
}
