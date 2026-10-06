"use client";
import { focusRing } from "@/components/dashboard/overview-kit";
import { plural } from "@/lib/dashboard";
import { inboxTime, type InboxItem } from "@/lib/messenger";
import { cn } from "@/lib/utils";
import { ProjectFaces } from "./conversation";

/** Every project conversation the viewer belongs to: the newest first, closed ones last. */
export function InboxList({ inbox, now, onPick }: {
    inbox: { active: InboxItem[]; closed: InboxItem[] };
    now: Date;
    onPick: (projectId: string) => void;
}) {
    if (inbox.active.length === 0 && inbox.closed.length === 0) {
        return <p className="grid flex-1 place-items-center px-8 text-center text-sm text-ink-tertiary">Conversations appear here when you join a project.</p>;
    }
    return (<div className="min-h-0 flex-1 overflow-y-auto p-2 [scrollbar-width:thin]">
      <ul>{inbox.active.map((item) => <Row key={item.id} item={item} now={now} onPick={onPick}/>)}</ul>
      {inbox.closed.length > 0 ? (<>
          <p className="px-3 pt-4 pb-1 text-xs font-medium text-ink-tertiary">Closed</p>
          <ul className="opacity-75">{inbox.closed.map((item) => <Row key={item.id} item={item} now={now} onPick={onPick}/>)}</ul>
        </>) : null}
    </div>);
}

function Row({ item, now, onPick }: {
    item: InboxItem;
    now: Date;
    onPick: (projectId: string) => void;
}) {
    const unread = item.unread > 0;
    return (<li>
      <button type="button" onClick={() => onPick(item.id)} className={cn("flex w-full cursor-pointer items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-200 hover:bg-surface-subtle", focusRing)}>
        <span className="flex w-11 shrink-0 justify-center"><ProjectFaces project={item}/></span>
        <span className="min-w-0 flex-1">
          <span className="flex items-baseline gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-sm text-ink", unread ? "font-semibold" : "font-medium")}>{item.title}</span>
            {item.lastAt ? <span className="shrink-0 text-[11px] text-ink-tertiary tabular">{inboxTime(item.lastAt, now)}</span> : null}
          </span>
          <span className="mt-0.5 flex items-center gap-2">
            <span className={cn("min-w-0 flex-1 truncate text-xs", unread ? "text-ink" : "text-ink-tertiary")}>{item.preview}</span>
            {unread ? (<span className="grid h-5 min-w-5 shrink-0 place-items-center rounded-full bg-brand px-1.5 text-[11px] font-semibold text-white tabular" aria-label={plural(item.unread, "unread message")}>
                {item.unread > 99 ? "99+" : item.unread}
              </span>) : null}
          </span>
        </span>
      </button>
    </li>);
}
