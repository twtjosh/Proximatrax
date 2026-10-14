import { projectBoardPath, projectPath, projectPhotosPath, projectReviewPath, projectSettingsPath, projectTeamPath, projectTimelinePath, } from "@/lib/constants";
import type { UserRole } from "@/types/enums";
export type ProjectWorkspaceTab = {
    href: string;
    label: string;
    exact?: boolean;
};
/** Each role's tabs inside a project. Super admins never reach project pages. */
export function projectWorkspaceTabs(projectId: string, role: UserRole): ProjectWorkspaceTab[] {
    const overview: ProjectWorkspaceTab = { href: projectPath(projectId), label: "Overview", exact: true };
    if (role === "project_manager") {
        return [
            overview,
            { href: projectReviewPath(projectId), label: "Review" },
            { href: projectBoardPath(projectId), label: "Board" },
            { href: projectTimelinePath(projectId), label: "Schedule" },
            { href: projectTeamPath(projectId), label: "Team" },
            { href: projectSettingsPath(projectId), label: "Details" },
        ];
    }
    if (role === "client") {
        return [
            overview,
            { href: projectBoardPath(projectId), label: "Updates" },
            { href: projectPhotosPath(projectId), label: "Photos" },
        ];
    }
    if (role === "middleman") {
        return [
            overview,
            { href: projectTimelinePath(projectId), label: "Schedule" },
            { href: projectPhotosPath(projectId), label: "Photos" },
        ];
    }
    return [overview];
}
