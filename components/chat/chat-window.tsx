"use client";
import * as React from "react";
import { CheckCheck, Loader2, Paperclip, Send } from "lucide-react";
import { toast } from "sonner";
import { Face, focusRing } from "@/components/dashboard/overview-kit";
import { formatTypingLabel, useProjectChatRealtime, usersWhoSeenMessage } from "@/hooks/use-project-chat-realtime";
import { cn } from "@/lib/utils";
import { publicAttachmentUrl, uploadChatAttachment } from "@/services/chat-attachment-service";
import type { ChatParticipant } from "@/services/chat-presence-service";
import { sendChatMessage } from "@/services/chat-service";
import type { ChatMessage, ChatMessageAttachment, Profile, ProjectChatReadCursor } from "@/types/database";

const TYPING_IDLE_MS = 2000;
/** Messages from one person within this window read as one group. */
const GROUP_MS = 5 * 60_000;
const TIME = new Intl.DateTimeFormat("en-US", { hour: "numeric", minute: "2-digit" });
const DAY_TIME = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });

type Person = Pick<Profile, "id" | "full_name" | "avatar_url">;

export type ChatWindowProps = {
    projectId: string;
    initialMessages: ChatMessage[];
    initialAttachments: ChatMessageAttachment[];
    viewerProfile: Person;
    senderProfiles: Record<string, Person>;
    participants: ChatParticipant[];
    initialReadCursors: ProjectChatReadCursor[];
    onAttachmentsChange?: (attachments: ChatMessageAttachment[]) => void;
    draft: string;
    onDraftChange: (text: string) => void;
};

export function ChatWindow({ projectId, initialMessages, initialAttachments, viewerProfile, senderProfiles, participants, initialReadCursors, onAttachmentsChange, draft, onDraftChange }: ChatWindowProps) {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const bottomRef = React.useRef<HTMLDivElement>(null);
    const typingIdleRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
    const isTypingRef = React.useRef(false);
    const [sending, setSending] = React.useState(false);
    const [uploading, setUploading] = React.useState(false);
    const { messages, attachments, senders, readCursors, typingUsers, pushMessage, pushAttachment, broadcastTyping } = useProjectChatRealtime({
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
        for (const item of attachments)
            map.set(item.message_id, [...(map.get(item.message_id) ?? []), item]);
        return map;
    }, [attachments]);
    const lastOwnMessageId = React.useMemo(() => messages.findLast((m) => m.sender_id === viewerProfile.id)?.id ?? null, [messages, viewerProfile.id]);
    const typingLabel = formatTypingLabel(typingUsers);

    React.useEffect(() => {
        bottomRef.current?.scrollIntoView({ block: "end" });
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
    React.useEffect(() => () => stopTyping(), [stopTyping]);

    function handleDraftChange(value: string) {
        onDraftChange(value);
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
        typingIdleRef.current = setTimeout(stopTyping, TYPING_IDLE_MS);
    }

    async function handleSend(e: React.FormEvent) {
        e.preventDefault();
        const text = draft.trim();
        if (!text || sending)
            return;
        stopTyping();
        setSending(true);
        try {
            pushMessage(await sendChatMessage(projectId, text));
            onDraftChange("");
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
            pushMessage({ id: attachment.message_id, project_id: projectId, sender_id: viewerProfile.id, content: file.name, created_at: attachment.created_at });
        }
        catch (err) {
            toast.error(err instanceof Error ? err.message : "Upload failed.");
        }
        finally {
            setUploading(false);
        }
    }

    return (<div className="flex min-h-0 flex-1 flex-col">
      <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 [scrollbar-width:thin]">
        {messages.length === 0 ? (<p className="grid h-full place-items-center px-6 text-center text-sm text-ink-tertiary">
            No messages yet. Say hello to the project team.
          </p>) : (<ol className="flex flex-col">
            {messages.map((m, i) => {
                const prev = messages[i - 1];
                const grouped = prev?.sender_id === m.sender_id && Date.parse(m.created_at) - Date.parse(prev.created_at) < GROUP_MS;
                const next = messages[i + 1];
                const lastInGroup = !(next?.sender_id === m.sender_id && Date.parse(next.created_at) - Date.parse(m.created_at) < GROUP_MS);
                const mine = m.sender_id === viewerProfile.id;
                const seenBy = mine && m.id === lastOwnMessageId ? usersWhoSeenMessage(m, readCursors, participants, viewerProfile.id) : [];
                return (<Bubble key={m.id} message={m} who={senders[m.sender_id]} mine={mine} grouped={grouped} lastInGroup={lastInGroup} attachments={attachmentsByMessage.get(m.id) ?? []} seenBy={seenBy}/>);
            })}
          </ol>)}
        {typingLabel ? (<p className="mt-3 flex items-center gap-2 text-xs text-ink-tertiary" aria-live="polite">
            <span className="flex gap-0.5" aria-hidden>
              {[0, 1, 2].map((i) => (<span key={i} className="size-1.5 animate-bounce rounded-full bg-ink-tertiary/60 motion-reduce:animate-none" style={{ animationDelay: `${i * 150}ms` }}/>))}
            </span>
            {typingLabel}
          </p>) : null}
        <div ref={bottomRef}/>
      </div>

      <form onSubmit={(e) => void handleSend(e)} className="shrink-0 border-t border-line p-3">
        <div className="flex items-center gap-1.5 rounded-full bg-surface-sunken p-1 pl-1.5">
          <input ref={fileInputRef} type="file" className="sr-only" accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.zip" onChange={(e) => void handleFilePick(e)}/>
          <button type="button" disabled={uploading || sending} onClick={() => fileInputRef.current?.click()} aria-label="Attach a file" className={cn("grid size-8 shrink-0 cursor-pointer place-items-center rounded-full text-ink-tertiary transition-colors hover:bg-surface hover:text-brand disabled:opacity-50", focusRing)}>
            {uploading ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Paperclip className="size-4" aria-hidden/>}
          </button>
          <input autoFocus value={draft} onChange={(e) => handleDraftChange(e.target.value)} placeholder="Message the project team" aria-label="Message" maxLength={4000} className="min-w-0 flex-1 bg-transparent text-sm text-ink outline-none placeholder:text-ink-tertiary"/>
          <button type="submit" disabled={sending || uploading || !draft.trim()} aria-label="Send" className={cn("grid size-8 shrink-0 cursor-pointer place-items-center rounded-full bg-brand text-white transition-[background-color,opacity] hover:bg-brand-hover disabled:cursor-default disabled:opacity-35", focusRing)}>
            {sending ? <Loader2 className="size-4 animate-spin" aria-hidden/> : <Send className="size-3.5" aria-hidden/>}
          </button>
        </div>
      </form>
    </div>);
}

function Bubble({ message, who, mine, grouped, lastInGroup, attachments, seenBy }: {
    message: ChatMessage;
    who?: Person;
    mine: boolean;
    grouped: boolean;
    lastInGroup: boolean;
    attachments: ChatMessageAttachment[];
    seenBy: ChatParticipant[];
}) {
    const onlyAttachment = attachments.length > 0 && message.content === attachments[0]?.file_name;
    const sent = new Date(message.created_at);
    const time = (sent.toDateString() === new Date().toDateString() ? TIME : DAY_TIME).format(sent);
    return (<li className={cn("flex items-end gap-2", mine ? "flex-row-reverse" : "flex-row", grouped ? "mt-0.5" : "mt-3 first:mt-0")}>
      {!mine ? (<span className="w-7 shrink-0">
          {lastInGroup ? <Face person={{ id: message.sender_id, name: who?.full_name ?? "Member", avatarUrl: who?.avatar_url ?? null, role: "" }} size={28}/> : null}
        </span>) : null}
      <div className={cn("flex max-w-[78%] min-w-0 flex-col", mine ? "items-end" : "items-start")}>
        {!mine && !grouped ? <p className="mb-1 px-3 text-[11px] font-medium text-ink-tertiary">{who?.full_name ?? "Member"}</p> : null}
        <div className={cn("overflow-hidden rounded-[18px]", mine ? "bg-brand text-white" : "bg-surface-sunken text-ink", mine && lastInGroup && "rounded-br-md", !mine && lastInGroup && "rounded-bl-md")} title={time}>
          {attachments.map((a) => <Attachment key={a.id} item={a} mine={mine}/>)}
          {!onlyAttachment ? <p className="px-3.5 py-2 text-sm leading-relaxed whitespace-pre-wrap break-words">{message.content}</p> : null}
        </div>
        {lastInGroup ? (<p className="mt-1 flex items-center gap-1 px-1 text-[10px] text-ink-tertiary tabular">
            {time}
            {seenBy.length > 0 ? (<><span aria-hidden>·</span><CheckCheck className="size-3 text-brand" aria-hidden/>Seen by {seenBy.map((u) => u.full_name.split(" ")[0]).join(", ")}</>) : null}
          </p>) : null}
      </div>
    </li>);
}

function Attachment({ item, mine }: {
    item: ChatMessageAttachment;
    mine: boolean;
}) {
    const url = publicAttachmentUrl(item.storage_path);
    if (item.media_kind === "photo") {
        return (<a href={url} target="_blank" rel="noopener noreferrer" className="block">
        {/* eslint-disable-next-line @next/next/no-img-element -- Supabase public URL, sized by CSS */}
        <img src={url} alt={item.file_name} className="max-h-56 w-full object-cover"/>
      </a>);
    }
    if (item.media_kind === "video")
        return <video src={url} controls preload="metadata" className="max-h-56 w-full bg-ink"/>;
    return (<a href={url} target="_blank" rel="noopener noreferrer" className={cn("flex items-center gap-2 px-3.5 py-2 text-sm font-medium hover:underline", mine ? "text-white" : "text-ink")}>
      <Paperclip className="size-3.5 shrink-0" aria-hidden/>
      <span className="truncate">{item.file_name}</span>
    </a>);
}
