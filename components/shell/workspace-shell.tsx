"use client";
import * as React from "react";
import { usePathname, useRouter } from "next/navigation";
import { MotionConfig } from "framer-motion";
import { Messenger } from "@/components/messenger/messenger";
import { MobileTabBar, MobileTopBar } from "@/components/shell/mobile-nav";
import type { NotificationsState } from "@/components/shell/notifications-menu";
import { ProjectSearch } from "@/components/shell/project-search";
import { Sidebar, type RailProject } from "@/components/shell/sidebar";
import { WorkspaceTheme } from "@/components/shell/workspace-theme";
import { useWorkNotifications } from "@/hooks/use-work-notifications";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { triageCounts, type InquiryTriageRow } from "@/lib/inquiry-triage";
import { canSearchProjects, primaryNavFor } from "@/lib/navigation";
import { listProjects } from "@/services/project-service";
import { useSidebarStore } from "@/store/use-sidebar-store";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";

const EMPTY_NOTIFICATIONS_COPY: Record<UserRole, string> = {
    super_admin: "",
    project_manager: "Updates about work assigned to you will appear here.",
    middleman: "You'll be told here when work is assigned to you or ready to start.",
    client: "You'll be told here when a milestone is delivered or a project is completed.",
};

function isTypingTarget(target: EventTarget | null) {
    if (!(target instanceof HTMLElement))
        return false;
    return target.isContentEditable || ["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName);
}

const subscribeNoop = () => () => { };

type WorkspaceShellProps = {
    profile: Profile;
    inquirySummaries?: InquiryTriageRow[];
    viewedInquiryIds?: string[];
    children: React.ReactNode;
};

/**
 * The one frame every signed-in role works inside. Role changes which
 * destinations appear, never how the frame looks or behaves.
 */
export function WorkspaceShell({ profile, inquirySummaries, viewedInquiryIds, children }: WorkspaceShellProps) {
    const router = useRouter();
    const role = profile.role;
    const navItems = React.useMemo(() => primaryNavFor(role), [role]);
    const homeHref = getRoleHomePath(role);
    const searchEnabled = canSearchProjects(role);
    const [searchOpen, setSearchOpen] = React.useState(false);

    const collapsed = useSidebarStore((s) => s.isCollapsed);
    const toggleCollapsed = useSidebarStore((s) => s.toggleSidebar);
    React.useEffect(() => {
        void useSidebarStore.persist.rehydrate();
    }, []);

    const shortcutLabel = React.useSyncExternalStore(subscribeNoop, () => (/Mac|iPhone|iPad/.test(navigator.platform) ? "⌘K" : "Ctrl K"), () => "Ctrl K");

    React.useEffect(() => {
        if (!searchEnabled)
            return;
        function onKeyDown(event: KeyboardEvent) {
            if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === "k") {
                event.preventDefault();
                setSearchOpen((open) => !open);
            }
            else if (event.key === "/" && !event.metaKey && !event.ctrlKey && !isTypingTarget(event.target)) {
                event.preventDefault();
                setSearchOpen(true);
            }
        }
        window.addEventListener("keydown", onKeyDown);
        return () => window.removeEventListener("keydown", onKeyDown);
    }, [searchEnabled]);

    // One subscription for the whole shell; the desktop and mobile menus
    // render the same state.
    const work = useWorkNotifications(role === "super_admin" ? undefined : profile.id);
    const { markRead, markAllRead } = work;
    const notifications: NotificationsState | null = role === "super_admin"
        ? null
        : {
            items: work.items,
            unreadCount: work.unreadCount,
            emptyMessage: EMPTY_NOTIFICATIONS_COPY[role],
            onOpen: (item) => {
                if (!item.read_at)
                    void markRead(item.id);
                router.push(item.href);
            },
            onMarkAllRead: () => void markAllRead(),
        };

    const badges = React.useMemo(() => ({
        inquiries: inquirySummaries ? triageCounts(inquirySummaries, viewedInquiryIds ?? []).totalUnopened : 0,
    }), [inquirySummaries, viewedInquiryIds]);

    const openSearch = searchEnabled ? () => setSearchOpen(true) : null;
    const railProjects = useRailProjects(searchEnabled);


    return (<WorkspaceTheme><MotionConfig reducedMotion="user">
      <div className="flex h-svh overflow-hidden bg-canvas text-ink">
        <a href="#workspace-main" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-md focus:bg-ink focus:px-3 focus:py-2 focus:text-sm focus:text-white">
          Skip to content
        </a>
        <Sidebar profile={profile} navItems={navItems} badges={badges} collapsed={collapsed} onToggleCollapsed={toggleCollapsed} onOpenSearch={openSearch} shortcutLabel={shortcutLabel} notifications={notifications} homeHref={homeHref} projects={railProjects}/>
        <div className="flex min-w-0 flex-1 flex-col">
          <MobileTopBar profile={profile} navItems={navItems} onOpenSearch={openSearch} notifications={notifications} homeHref={homeHref}/>
          <main id="workspace-main" tabIndex={-1} className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-5 outline-none sm:px-6 lg:px-8 lg:py-7">
            {children}
          </main>
          <MobileTabBar navItems={navItems} badges={badges}/>
        </div>
        {searchEnabled ? (<ProjectSearch open={searchOpen} onOpenChange={setSearchOpen} navItems={navItems}/>) : null}
        {role !== "super_admin" ? <Messenger viewer={profile}/> : null}
      </div>
    </MotionConfig></WorkspaceTheme>);
}

/**
 * Active projects for the rail, scoped by RLS to what the viewer can see.
 * Loaded once, and again when the viewer opens a project the list lacks
 * (one just created, say).
 */
function useRailProjects(enabled: boolean): RailProject[] | null {
    const pathname = usePathname();
    const [loaded, setLoaded] = React.useState<{
        rows: RailProject[];
        /** The project page open when this list was fetched. */
        fetchedOn: string | null;
    } | null>(null);
    const openId = pathname.match(new RegExp(`^${ROUTES.PROJECTS}/([^/]+)`))?.[1] ?? null;
    const stale = loaded === null || (!!openId && openId !== "new" && openId !== loaded.fetchedOn && !loaded.rows.some((p) => p.id === openId));
    React.useEffect(() => {
        if (!enabled || !stale)
            return;
        let cancelled = false;
        listProjects(undefined, { lifecycle: "active" })
            .then((rows) => {
            if (!cancelled)
                setLoaded({ rows: rows.map((p) => ({ id: p.id, title: p.title })), fetchedOn: openId });
        })
            .catch(() => {
            // The rail list is a shortcut; the Projects page still works.
        });
        return () => {
            cancelled = true;
        };
    }, [enabled, stale, openId]);
    return loaded?.rows ?? null;
}
