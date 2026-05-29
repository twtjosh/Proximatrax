export const ROUTES = {
    HOME: "/",
    LOGIN: "/login",
    FORGOT_PASSWORD: "/forgot-password",
    DASHBOARD: "/dashboard",
    PROJECTS: "/projects",
    ACTIVITY: "/activity",
    TEAM: "/team",
    FILES: "/files",
    ACCOUNT: "/account",
    MIDDLEMAN_HOME: "/middleman",
    MIDDLEMAN_ACCOUNT: "/middleman/account",
    INQUIRIES: "/inquiries",
    SETTINGS: "/settings",
} as const;
export const projectPath = (id: string) => `${ROUTES.PROJECTS}/${id}`;
export type ProjectBoardQuery = {
    stage?: string;
    milestone?: string;
    assignee?: string;
    mine?: "1";
    q?: string;
    view?: "all";
};
export const projectBoardPath = (id: string, query?: ProjectBoardQuery) => {
    const base = `${projectPath(id)}/board`;
    if (!query)
        return base;
    const params = new URLSearchParams();
    if (query.stage)
        params.set("stage", query.stage);
    if (query.milestone)
        params.set("milestone", query.milestone);
    if (query.assignee)
        params.set("assignee", query.assignee);
    if (query.mine === "1")
        params.set("mine", "1");
    if (query.q)
        params.set("q", query.q);
    if (query.view)
        params.set("view", query.view);
    const qs = params.toString();
    return qs ? `${base}?${qs}` : base;
};
export const projectTimelinePath = (id: string) => `${projectPath(id)}/timeline`;
export const projectFilesPath = (id: string) => `${projectPath(id)}/files`;
export const projectChatPath = (id: string) => `${projectPath(id)}/chat`;
export const projectMessagesPath = (id: string) => `${projectPath(id)}/messages`;
export const projectActivityPath = (id: string) => `${projectPath(id)}/activity`;
export const projectTeamPath = (id: string) => `${projectPath(id)}/team`;
export const projectSettingsPath = (id: string) => `${projectPath(id)}/settings`;
export const projectAnalyticsPath = (id: string) => `${projectPath(id)}/analytics`;
export type ProjectsListView = "active" | "completed";
export const projectsListPath = (view: ProjectsListView = "active") => {
    if (view === "completed")
        return `${ROUTES.PROJECTS}?view=completed`;
    return ROUTES.PROJECTS;
};
const AUTH_PATHS: readonly string[] = [
    ROUTES.LOGIN,
    ROUTES.FORGOT_PASSWORD,
];
export function sanitizeNextPath(value: string | null | undefined): string | null {
    if (!value)
        return null;
    if (!value.startsWith("/"))
        return null;
    if (value.startsWith("//"))
        return null;
    if (AUTH_PATHS.some((p) => value === p || value.startsWith(`${p}/`))) {
        return null;
    }
    return value;
}
export const ROLE_HOME_PATHS: Record<string, string> = {
    super_admin: ROUTES.DASHBOARD,
    project_manager: ROUTES.DASHBOARD,
    middleman: ROUTES.MIDDLEMAN_HOME,
    client: ROUTES.DASHBOARD,
} as const;
export const ROLE_LABELS: Record<string, string> = {
    super_admin: "Super Admin",
    project_manager: "Project Manager",
    middleman: "Middleman",
    client: "Client",
} as const;
export const TASK_STAGE_LABELS: Record<string, string> = {
    backlog: "Backlog",
    to_do: "To Do",
    in_progress: "In Progress",
    review: "Review",
    done: "Done",
} as const;
export function getRoleHomePath(role?: string | null) {
    if (!role) {
        return ROUTES.DASHBOARD;
    }
    return ROLE_HOME_PATHS[role] ?? ROUTES.DASHBOARD;
}
