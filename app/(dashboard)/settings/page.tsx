import { redirect } from "next/navigation";
import { ROUTES } from "@/lib/constants";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { PeopleDirectory, type Person } from "./people-directory";
export default async function SettingsPage() {
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    if ((profile as Profile | null)?.role !== "super_admin") {
        redirect(ROUTES.DASHBOARD);
    }
    const [{ data: allProfiles }, { data: projects }, { data: members }, { data: openTasks }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("projects").select("id, title, pm_id, client_id, status"),
        supabase.from("project_members").select("user_id, project_id"),
        supabase.from("tasks").select("assigned_to, project_id").neq("stage", "done").not("assigned_to", "is", null),
    ]);
    const projectRows = (projects ?? []) as { id: string; title: string; pm_id: string; client_id: string; status: string }[];
    const activeIds = new Set(projectRows.filter((p) => p.status !== "completed").map((p) => p.id));
    // Each person's active projects in any part (PM, client, crew), plus the links that block removing them.
    const active = new Map<string, Set<string>>();
    const link = (userId: string, projectId: string) => {
        if (!activeIds.has(projectId))
            return;
        if (!active.has(userId))
            active.set(userId, new Set());
        active.get(userId)!.add(projectId);
    };
    for (const p of projectRows) {
        link(p.pm_id, p.id);
        link(p.client_id, p.id);
    }
    const crewOn = new Map<string, string[]>();
    for (const m of (members ?? []) as { user_id: string; project_id: string }[]) {
        link(m.user_id, m.project_id);
        if (activeIds.has(m.project_id))
            crewOn.set(m.user_id, [...(crewOn.get(m.user_id) ?? []), projectRows.find((r) => r.id === m.project_id)?.title ?? "Untitled project"]);
    }
    const openCount = new Map<string, number>();
    for (const t of (openTasks ?? []) as { assigned_to: string; project_id: string }[])
        if (activeIds.has(t.project_id))
            openCount.set(t.assigned_to, (openCount.get(t.assigned_to) ?? 0) + 1);
    const people: Person[] = ((allProfiles ?? []) as Profile[]).map((p) => ({
        ...p,
        activeProjects: active.get(p.id)?.size ?? 0,
        managed: projectRows.filter((r) => r.pm_id === p.id).length,
        clientOf: projectRows.filter((r) => r.client_id === p.id).length,
        crewOn: crewOn.get(p.id) ?? [],
        openTasks: openCount.get(p.id) ?? 0,
    }));
    return <PeopleDirectory people={people} currentUserId={user.id}/>;
}
