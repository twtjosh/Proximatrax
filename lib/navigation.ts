import { ClipboardList, FolderKanban, Inbox, LayoutDashboard, Users, UserCog, type LucideIcon } from "lucide-react";
import { ROUTES } from "@/lib/constants";
import type { UserRole } from "@/types/enums";

export type NavItem = {
    href: string;
    label: string;
    icon: LucideIcon;
    /** Paths nested under this item that should keep it highlighted. */
    nested?: boolean;
    badge?: "inquiries";
};

/**
 * Primary destinations per role. Account settings live in the account
 * menu, not here, so the list only holds places where work happens.
 */
export function primaryNavFor(role: UserRole): NavItem[] {
    switch (role) {
        case "super_admin":
            return [
                { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
                { href: ROUTES.INQUIRIES, label: "Inquiries", icon: Inbox, nested: true, badge: "inquiries" },
                { href: ROUTES.SETTINGS, label: "People", icon: UserCog, nested: true },
            ];
        case "middleman":
            return [
                { href: ROUTES.MIDDLEMAN_HOME, label: "My work", icon: ClipboardList },
                { href: ROUTES.PROJECTS, label: "Projects", icon: FolderKanban, nested: true },
            ];
        case "client":
            return [
                { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
                { href: ROUTES.PROJECTS, label: "Projects", icon: FolderKanban, nested: true },
            ];
        case "project_manager":
        default:
            return [
                { href: ROUTES.DASHBOARD, label: "Overview", icon: LayoutDashboard },
                { href: ROUTES.PROJECTS, label: "Projects", icon: FolderKanban, nested: true },
                { href: ROUTES.TEAM, label: "Team", icon: Users, nested: true },
            ];
    }
}

export function accountPathFor(role: UserRole): string | null {
    if (role === "super_admin")
        return null;
    return role === "middleman" ? ROUTES.MIDDLEMAN_ACCOUNT : ROUTES.ACCOUNT;
}

export function isNavItemActive(item: NavItem, pathname: string): boolean {
    if (pathname === item.href)
        return true;
    return Boolean(item.nested) && pathname.startsWith(`${item.href}/`);
}

/** Project search is useful only to roles that work inside projects. */
export function canSearchProjects(role: UserRole): boolean {
    return role !== "super_admin";
}
