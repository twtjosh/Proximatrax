import { projectAnalyticsPath, projectBoardPath, projectMessagesPath, projectPath, projectSettingsPath, projectTeamPath, projectTimelinePath, } from "@/lib/constants";
import type { UserRole } from "@/types/enums";
export type ProjectWorkspaceTab = {
    href: string;
    label: string;
    exact?: boolean;
};
export function projectWorkspaceTabs(projectId: string, role: UserRole): ProjectWorkspaceTab[] {
    const all: ProjectWorkspaceTab[] = [
        { href: projectPath(projectId), label: "Overview", exact: true },
        { href: projectBoardPath(projectId), label: "Board" },
        { href: projectTimelinePath(projectId), label: "Timeline" },
        { href: projectMessagesPath(projectId), label: "Messages" },
        { href: projectTeamPath(projectId), label: "Team" },
        { href: projectSettingsPath(projectId), label: "Settings" },
    ];
    if (role === "project_manager") {
        return all.map((t) => t.href === projectBoardPath(projectId)
            ? { ...t, label: "Inspection" }
            : t);
    }
    if (role === "client") {
        return [
            { href: projectPath(projectId), label: "Overview", exact: true },
            { href: projectBoardPath(projectId), label: "Updates" },
            { href: projectTimelinePath(projectId), label: "Timeline" },
            { href: projectMessagesPath(projectId), label: "Messages" },
            { href: projectAnalyticsPath(projectId), label: "Analytics" },
        ];
    }
    return all
        .filter((t) => t.href !== projectSettingsPath(projectId))
        .map((t) => t.href === projectBoardPath(projectId)
        ? { ...t, label: "My work" }
        : t);
}
