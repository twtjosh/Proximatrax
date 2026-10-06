"use client";
import * as React from "react";
import { AnimatePresence, motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { Loader2, MessageCircle, Minus } from "lucide-react";
import { focusRing } from "@/components/dashboard/overview-kit";
import { plural } from "@/lib/dashboard";
import { buildInbox, resolveActive, totalUnread, unreadByProject, type InboxProject, type InboxRow } from "@/lib/messenger";
import { SPRING } from "@/lib/motion";
import { createClient } from "@/lib/supabase/client";
import { removeRealtimeChannelByName } from "@/lib/supabase/realtime-channel";
import { cn } from "@/lib/utils";
import { ROLE_TERMS } from "@/lib/vocabulary";
import { listChatInbox } from "@/services/chat-presence-service";
import { listProjects, type ProjectWithRelations } from "@/services/project-service";
import type { Profile } from "@/types/database";
import { Conversation, PanelIconButton } from "./conversation";
import { InboxList } from "./inbox-list";
import { openChat, useMessenger } from "./messenger-store";

/** Coalesces bursts of realtime events into one inbox refetch. */
const REFRESH_MS = 300;

const slide = {
    enter: (dir: number) => ({ x: dir > 0 ? "100%" : "-25%", opacity: dir > 0 ? 1 : 0 }),
    center: { x: 0, opacity: 1 },
    exit: (dir: number) => ({ x: dir > 0 ? "-25%" : "100%", opacity: dir > 0 ? 0 : 1 }),
};

function toInboxProject(p: ProjectWithRelations, viewerId: string): InboxProject {
    const people: InboxProject["people"] = [];
    if (p.pm && p.pm.id !== viewerId)
        people.push({ id: p.pm.id, name: p.pm.full_name ?? ROLE_TERMS.project_manager, avatarUrl: p.pm.avatar_url, role: ROLE_TERMS.project_manager });
    if (p.client && p.client.id !== viewerId)
        people.push({ id: p.client.id, name: p.client.full_name ?? ROLE_TERMS.client, avatarUrl: p.client.avatar_url, role: ROLE_TERMS.client });
    return { id: p.id, title: p.title, status: p.status, people };
}

const PHONE = "(max-width: 639px)";
const subscribePhone = (onChange: () => void) => {
    const mq = window.matchMedia(PHONE);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
};
/** Below sm the panel is a full-screen sheet, so it is modal there. */
function usePhone() {
    return React.useSyncExternalStore(subscribePhone, () => window.matchMedia(PHONE).matches, () => false);
}

/** The one place to chat: a bubble that opens every project conversation the viewer belongs to. */
export function Messenger({ viewer }: {
    viewer: Pick<Profile, "id" | "full_name" | "avatar_url">;
}) {
    const router = useRouter();
    const pathname = usePathname();
    const open = useMessenger((s) => s.open);
    const activeProjectId = useMessenger((s) => s.activeProjectId);
    const openedAt = useMessenger((s) => s.openedAt);
    const minimize = useMessenger((s) => s.minimize);
    const back = useMessenger((s) => s.back);
    const setUnread = useMessenger((s) => s.setUnread);
    const panelRef = React.useRef<HTMLElement>(null);
    const bubbleRef = React.useRef<HTMLButtonElement>(null);
    const headingRef = React.useRef<HTMLHeadingElement>(null);
    const phone = usePhone();
    /** Start time of the newest load that has finished. */
    const [loadedFrom, setLoadedFrom] = React.useState(-1);
    const [projects, setProjects] = React.useState<InboxProject[] | null>(null);
    const [rows, setRows] = React.useState<InboxRow[]>([]);
    const [failed, setFailed] = React.useState(false);
    const [now, setNow] = React.useState(() => new Date());

    const load = React.useCallback(async () => {
        const startedAt = Date.now();
        try {
            const [list, inbox] = await Promise.all([listProjects(), listChatInbox()]);
            setProjects(list.map((p) => toInboxProject(p, viewer.id)));
            setRows(inbox);
            setFailed(false);
        }
        catch {
            setFailed(true);
        }
        setNow(new Date());
        setLoadedFrom((prev) => Math.max(prev, startedAt));
    }, [viewer.id]);

    // On mount, and every time something opens the panel (new projects, fresh times).
    React.useEffect(() => {
        void load();
    }, [load, openedAt]);

    // One channel for every room: RLS limits inserts to the viewer's projects.
    React.useEffect(() => {
        const sb = createClient();
        const name = `messenger:${viewer.id}`;
        removeRealtimeChannelByName(sb, name);
        let timer: ReturnType<typeof setTimeout> | undefined;
        const refresh = () => {
            clearTimeout(timer);
            timer = setTimeout(() => void load(), REFRESH_MS);
        };
        const channel = sb.channel(name)
            .on("postgres_changes", { event: "INSERT", schema: "public", table: "chat_messages" }, refresh)
            .on("postgres_changes", { event: "*", schema: "public", table: "project_chat_read_cursors", filter: `user_id=eq.${viewer.id}` }, refresh)
            .subscribe();
        return () => {
            clearTimeout(timer);
            void sb.removeChannel(channel);
        };
    }, [viewer.id, load]);

    // Old /messages links arrive as ?chat=<projectId>.
    React.useEffect(() => {
        const id = new URLSearchParams(window.location.search).get("chat");
        if (!id)
            return;
        openChat(id);
        router.replace(pathname, { scroll: false });
    }, [pathname, router]);

    // Esc or a click outside tucks the panel away.
    React.useEffect(() => {
        if (!open)
            return;
        const onKey = (e: KeyboardEvent) => {
            if (e.key === "Escape")
                minimize();
        };
        const onPointer = (e: PointerEvent) => {
            // Toasts float over the panel; dismissing one isn't leaving the chat.
            if ((e.target as Element).closest?.("[data-sonner-toaster]"))
                return;
            if (panelRef.current && !panelRef.current.contains(e.target as Node))
                minimize();
        };
        window.addEventListener("keydown", onKey);
        document.addEventListener("pointerdown", onPointer);
        return () => {
            window.removeEventListener("keydown", onKey);
            document.removeEventListener("pointerdown", onPointer);
        };
    }, [open, minimize]);

    const inbox = React.useMemo(() => (projects ? buildInbox(projects, rows, viewer.id) : null), [projects, rows, viewer.id]);
    const all = inbox ? [...inbox.active, ...inbox.closed] : [];
    const unread = totalUnread(all);
    const { item: active, fallBack } = resolveActive(inbox ? all : null, activeProjectId, loadedFrom >= openedAt);

    // A conversation the viewer can't see (old link, removed member) falls back to the list.
    React.useEffect(() => {
        if (fallBack)
            back();
    }, [fallBack, back]);

    // Badges outside the messenger follow the same counts.
    React.useEffect(() => {
        setUnread(inbox ? unreadByProject([...inbox.active, ...inbox.closed]) : null);
    }, [inbox, setUnread]);

    // Focus follows the panel: its heading on open, the bubble again on minimize
    // (unless the viewer clicked away onto something else).
    const wasOpen = React.useRef(false);
    React.useEffect(() => {
        if (open && !active)
            headingRef.current?.focus({ preventScroll: true });
        if (!open && wasOpen.current) {
            const at = document.activeElement;
            if (!at || at === document.body || panelRef.current?.contains(at))
                bubbleRef.current?.focus({ preventScroll: true });
        }
        wasOpen.current = open;
    }, [open, active]);

    const dir = active ? 1 : -1;

    return (<>
      <AnimatePresence>
        {!open ? (<motion.button key="bubble" ref={bubbleRef} type="button" onClick={() => openChat()} initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.6, opacity: 0 }} whileTap={{ scale: 0.94 }} transition={SPRING} aria-label={unread > 0 ? `Messages, ${plural(unread, "unread message")}` : "Messages"} className={cn("fixed right-4 bottom-[calc(4.5rem+env(safe-area-inset-bottom))] z-40 grid size-14 cursor-pointer place-items-center rounded-full bg-brand text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.2),0_14px_30px_-10px_rgb(180_83_9/0.6)] transition-colors hover:bg-brand-hover lg:right-6 lg:bottom-6", focusRing)}>
            <MessageCircle className="size-6" aria-hidden/>
            {unread > 0 ? (<span aria-hidden className="absolute -top-0.5 -right-0.5 grid h-5 min-w-5 place-items-center rounded-full bg-surface px-1 text-[11px] font-semibold text-brand ring-2 ring-brand tabular">
                {unread > 99 ? "99+" : unread}
              </span>) : null}
          </motion.button>) : null}
      </AnimatePresence>

      <AnimatePresence>
        {open ? (<motion.section key="panel" ref={panelRef} role="dialog" aria-label="Messages" aria-modal={phone || undefined} initial={{ opacity: 0, scale: 0.92, y: 16 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.92, y: 16 }} transition={SPRING} className="fixed inset-0 z-40 flex origin-bottom-right flex-col overflow-hidden bg-surface sm:inset-auto sm:right-6 sm:bottom-6 sm:h-[min(640px,calc(100svh-6rem))] sm:w-[380px] sm:rounded-[24px] sm:border sm:border-line sm:shadow-[0_28px_70px_-24px_rgb(14_18_34/0.4)]">
            <div className="relative min-h-0 flex-1 overflow-hidden">
              <AnimatePresence initial={false} custom={dir}>
                <motion.div key={active?.id ?? "list"} custom={dir} variants={slide} initial="enter" animate="center" exit="exit" transition={SPRING} className="absolute inset-0 flex flex-col bg-surface">
                  {active ? (<Conversation project={active} viewer={viewer} onBack={back} onMinimize={minimize}/>) : (<>
                      <header className="flex shrink-0 items-center justify-between py-2 pr-2 pl-5">
                        <h2 ref={headingRef} tabIndex={-1} className="type-title text-lg font-semibold tracking-[-0.02em] text-ink outline-none">Messages</h2>
                        <PanelIconButton label="Minimize" onClick={minimize}><Minus/></PanelIconButton>
                      </header>
                      {failed && !inbox ? (<div className="grid flex-1 place-items-center p-6 text-center">
                          <div>
                            <p className="text-sm text-ink-secondary">Messages couldn&apos;t load.</p>
                            <button type="button" onClick={() => void load()} className={cn("mt-3 cursor-pointer rounded-full bg-surface-sunken px-4 py-1.5 text-sm font-medium text-ink hover:bg-line", focusRing)}>Retry</button>
                          </div>
                        </div>) : !inbox ? (<div className="grid flex-1 place-items-center" role="status" aria-label="Loading conversations">
                          <Loader2 className="size-5 animate-spin text-ink-tertiary" aria-hidden/>
                        </div>) : (<InboxList inbox={inbox} now={now} onPick={(id) => openChat(id)}/>)}
                    </>)}
                </motion.div>
              </AnimatePresence>
            </div>
          </motion.section>) : null}
      </AnimatePresence>
    </>);
}
