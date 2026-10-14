import { projectActivityPath, projectBoardPath, projectFilesPath, projectPath, projectPhotosPath, projectTeamPath, projectTimelinePath } from "@/lib/constants";
import type { UserRole } from "@/types/enums";
export type ProjectWorkspaceTab = {
    href: string;
    label: string;
    exact?: boolean;
};
/**
 * Each role's tabs inside a project. The PM's review queue, settings and
 * report open over any tab instead of being tabs. Super admins never reach
 * project pages.
 */
export function projectWorkspaceTabs(projectId: string, role: UserRole): ProjectWorkspaceTab[] {
    const overview: ProjectWorkspaceTab = { href: projectPath(projectId), label: "Overview", exact: true };
    if (role === "project_manager") {
        return [
            overview,
            { href: projectBoardPath(projectId), label: "Tasks" },
            { href: projectTimelinePath(projectId), label: "Timeline" },
            { href: projectFilesPath(projectId), label: "Files" },
            { href: projectTeamPath(projectId), label: "Team" },
            { href: projectActivityPath(projectId), label: "Activity" },
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
