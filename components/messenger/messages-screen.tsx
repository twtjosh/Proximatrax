"use client";
import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUpRight, Check, Loader2, X } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { Sheet, SheetClose, SheetContent, SheetTitle } from "@/components/ui/sheet";
import { projectPath, ROUTES } from "@/lib/constants";
import { plural } from "@/lib/dashboard";
import type { InboxItem } from "@/lib/messenger";
import { cn } from "@/lib/utils";
import type { ChatParticipant } from "@/services/chat-presence-service";
import { Conversation, ProjectFaces } from "./conversation";
import { useMessenger, type Inbox } from "./messenger-store";

/** Cancels the scroll area's padding so the screen runs edge to edge, white, down behind the dock. */
const BLEED = "-mx-4 -mt-5 sm:-mx-6 lg:-mx-8 lg:-mt-7 lg:-mb-7 max-lg:-mb-[calc(env(safe-area-inset-bottom)+4.5rem)] max-lg:pb-[calc(env(safe-area-inset-bottom)+4.5rem)]";

/**
 * Messages as a screen of its own, for clients and crew on phones and
 * tablets. It opens straight into a conversation (most clients have one
 * project, so a list first would be a wasted tap); the room's name at the
 * top switches to the others in a sheet. The inbox is the messenger's, live.
 */
export function MessagesScreen({ viewer, projectId }: {
    viewer: ChatParticipant;
    /** The room asked for in the address; else the newest. */
    projectId: string | null;
}) {
    const router = useRouter();
    const inbox = useMessenger((s) => s.inbox);
    const [switching, setSwitching] = React.useState(false);
    const all = inbox ? [...inbox.active, ...inbox.closed] : [];
    const current = all.find((i) => i.id === projectId) ?? all[0];
    const elsewhere = all.reduce((sum, i) => (i.id === current?.id ? sum : sum + i.unread), 0);

    return (<div className={cn("flex min-h-0 flex-1 flex-col bg-surface", BLEED)}>
      <h1 className="sr-only">Messages</h1>
      {!inbox ? (<div className="grid flex-1 place-items-center" role="status" aria-label="Loading conversations">
          <Loader2 className="size-5 animate-spin text-ink-tertiary" aria-hidden/>
        </div>) : !current ? (<div className="grid flex-1 place-items-center px-8 text-center">
          <div>
            <p className="text-[17px] font-semibold tracking-[-0.016em] text-ink">No conversations yet</p>
            <p className="mt-1.5 text-sm leading-relaxed text-ink-tertiary">Each project you join has its own conversation with its project manager and team.</p>
          </div>
        </div>) : (<>
          {/* A reading column on wide screens; on a phone it is the whole screen anyway. */}
          <div className="mx-auto flex min-h-0 w-full max-w-3xl flex-1 flex-col">
            <Conversation key={current.id} project={current} viewer={viewer} screen={{ onSwitch: () => setSwitching(true), elsewhere }}/>
          </div>
          <RoomSheet open={switching} onOpenChange={setSwitching} inbox={inbox} currentId={current.id} onPick={(id) => {
                setSwitching(false);
                router.replace(`${ROUTES.MESSAGES}?project=${id}`);
            }}/>
        </>)}
    </div>);
}

/** Every room the viewer is in, rising from the foot of the screen: active first, closed after. */
function RoomSheet({ open, onOpenChange, inbox, currentId, onPick }: {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    inbox: Inbox;
    currentId: string;
    onPick: (projectId: string) => void;
}) {
    return (<Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" showCloseButton={false} className="max-h-[80svh] gap-0 rounded-t-[30px] border-0 bg-surface px-4 pt-2 pb-[calc(env(safe-area-inset-bottom)+1.25rem)] text-ink shadow-[0_-20px_50px_-20px_rgb(14_18_34/0.5)]">
        <span aria-hidden className="mx-auto block h-1.5 w-10 shrink-0 rounded-full bg-line-strong"/>
        <div className="mt-3 flex shrink-0 items-center justify-between px-1">
          <SheetTitle className="text-xl font-semibold tracking-[-0.02em] text-ink">Your conversations</SheetTitle>
          <SheetClose render={<button type="button" aria-label="Close" className={cn("press grid size-10 cursor-pointer place-items-center rounded-full bg-surface-sunken text-ink-secondary hover:text-ink", focusRing)}/>}>
            <X className="size-4" aria-hidden/>
          </SheetClose>
        </div>
        {/* Scrolls only up and down; a pixel of room each side keeps the open room's outline from being clipped. */}
        <div className="-mx-1 mt-3 min-h-0 overflow-x-hidden overflow-y-auto px-1 pb-1">
          <ul className="grid grid-cols-1 gap-1.5">
            {inbox.active.map((item) => <Room key={item.id} item={item} current={item.id === currentId} onPick={onPick}/>)}
          </ul>
          {inbox.closed.length > 0 ? (<>
              <p className="px-3 pt-4 pb-1.5 text-xs font-semibold tracking-[0.04em] text-ink-tertiary uppercase">Closed</p>
              <ul className="grid grid-cols-1 gap-1.5">
                {inbox.closed.map((item) => <Room key={item.id} item={item} current={item.id === currentId} onPick={onPick}/>)}
              </ul>
            </>) : null}
        </div>
      </SheetContent>
    </Sheet>);
}

/** One room: who is in it, the last word, and its unread count; the open one is marked and leads to its project. */
function Room({ item, current, onPick }: {
    item: InboxItem;
    current: boolean;
    onPick: (projectId: string) => void;
}) {
    const unread = item.unread > 0;
    return (<li className="flex items-center gap-1">
      <button type="button" onClick={() => onPick(item.id)} aria-current={current || undefined} className={cn("press flex min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[18px] p-3 text-left transition-colors duration-300", current ? "bg-brand-soft ring-[1.5px] ring-copper/50" : "hover:bg-surface-subtle", focusRing)}>
        {/* Sized by its faces (two overlap), never squeezed into a fixed slot that would spill over the name. */}
        <span className="flex shrink-0"><ProjectFaces project={item} size={36}/></span>
        <span className="min-w-0 flex-1">
          <span className={cn("block truncate text-[15px] font-semibold", item.status === "completed" ? "text-ink-secondary" : "text-ink")}>{item.title}</span>
          <span className={cn("block truncate text-[13px]", unread ? "font-medium text-ink" : "text-ink-tertiary")}>{item.preview}</span>
        </span>
        {current ? <Check className="size-5 shrink-0 text-brand" strokeWidth={2.6} aria-hidden/> : unread ? (<span aria-label={plural(item.unread, "unread message")} className="grid h-5.5 min-w-5.5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-xs font-semibold text-white tabular">
            {item.unread > 99 ? "99+" : item.unread}
          </span>) : null}
      </button>
      {current ? (<Link href={projectPath(item.id)} aria-label={`Open ${item.title}`} className={cn("press grid size-11 shrink-0 place-items-center rounded-full text-ink-secondary hover:bg-surface-sunken hover:text-ink", focusRing)}>
          <ArrowUpRight className="size-5" aria-hidden/>
        </Link>) : null}
    </li>);
}
