import { create } from "zustand";
import { askDraft } from "@/lib/calendar";
import type { InboxItem } from "@/lib/messenger";

type MessengerState = {
    open: boolean;
    /** The conversation on screen; null shows the list. Kept while minimized. */
    activeProjectId: string | null;
    /** Unsent text per project, for the session. */
    drafts: Record<string, string>;
    /** When openChat last ran; a load must start after it before a missing project counts as gone. */
    openedAt: number;
    /** Live unread per project from the inbox; null until it loads. */
    unread: Record<string, number> | null;
    /** The live inbox, for the phone Messages screen; null until it loads. */
    inbox: Inbox | null;
    /** Open the panel: on `projectId` when given, else where the viewer left off. */
    openChat: (projectId?: string) => void;
    minimize: () => void;
    back: () => void;
    setDraft: (projectId: string, text: string) => void;
    setUnread: (unread: Record<string, number> | null) => void;
    setInbox: (inbox: Inbox | null) => void;
};

export type Inbox = { active: InboxItem[]; closed: InboxItem[] };

export const useMessenger = create<MessengerState>()((set) => ({
    open: false,
    activeProjectId: null,
    drafts: {},
    openedAt: 0,
    unread: null,
    inbox: null,
    openChat: (projectId) => set((s) => ({ open: true, activeProjectId: projectId ?? s.activeProjectId, openedAt: Date.now() })),
    minimize: () => set({ open: false }),
    back: () => set({ activeProjectId: null }),
    setDraft: (projectId, text) => set((s) => ({ drafts: { ...s.drafts, [projectId]: text } })),
    setUnread: (unread) => set({ unread }),
    setInbox: (inbox) => set({ inbox }),
}));

/** A badge's count: live from the messenger once loaded, else the server's. */
export function useLiveUnread(projectId: string, serverCount: number): number {
    return useMessenger((s) => s.unread?.[projectId]) ?? serverCount;
}

/** For "Message" buttons anywhere in the app. */
export const openChat = (projectId?: string) => useMessenger.getState().openChat(projectId);

/** "Ask about this": opens the project's chat with a question about `subject` already started. */
export function askAbout(projectId: string, subject: string) {
    const state = useMessenger.getState();
    state.setDraft(projectId, askDraft(subject, state.drafts[projectId] ?? ""));
    state.openChat(projectId);
}
