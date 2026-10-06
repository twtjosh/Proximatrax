import type { SupabaseClient } from "@supabase/supabase-js";
import { ROLE_TERMS } from "@/lib/vocabulary";
import { countUnreadChatMessages } from "@/services/chat-presence-service";
import type { ProjectWithRelations } from "@/services/project-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";

export type TeamMember = {
    id: string;
    name: string;
    avatarUrl: string | null;
    /** Their part in this project, from the shared vocabulary. */
    role: string;
};

export type ProjectContext = {
    teams: Record<string, TeamMember[]>;
    /** Chat messages from others the viewer has not read yet, per project. */
    unread: Record<string, number>;
};

type ProfileRow = Pick<Profile, "id" | "full_name" | "avatar_url" | "role">;

/**
 * Who works on each project (project manager, client, then members) and how
 * many of its messages the viewer has not read. Both only decorate the
 * Overview, so a failed read yields empty context rather than an error.
 */
export async function loadProjectContext(supabase: SupabaseClient, projects: ProjectWithRelations[], viewerId: string): Promise<ProjectContext> {
    const ids = projects.map((p) => p.id);
    if (ids.length === 0)
        return { teams: {}, unread: {} };

    const [members, unreadCounts] = await Promise.all([
        supabase.from("project_members").select("project_id, user_id, role_in_project").in("project_id", ids),
        // ponytail: two small queries per project; fine for a PM's handful of active projects, batch with an RPC if that grows.
        Promise.all(ids.map((id) => countUnreadChatMessages(id, viewerId, supabase).catch(() => 0))),
    ]);
    const memberRows = (members.data ?? []) as { project_id: string; user_id: string; role_in_project: string }[];

    const known = new Map<string, ProfileRow>();
    for (const p of projects) {
        if (p.pm)
            known.set(p.pm.id, p.pm);
        if (p.client)
            known.set(p.client.id, p.client);
    }
    const missing = [...new Set(memberRows.map((m) => m.user_id))].filter((id) => !known.has(id));
    if (missing.length > 0) {
        const { data } = await supabase.from("profiles").select("id, full_name, avatar_url, role").in("id", missing);
        for (const row of (data ?? []) as ProfileRow[])
            known.set(row.id, row);
    }

    const person = (row: ProfileRow, role: string): TeamMember => ({ id: row.id, name: row.full_name ?? "Unnamed", avatarUrl: row.avatar_url, role });
    const teams: Record<string, TeamMember[]> = {};
    for (const p of projects) {
        const team: TeamMember[] = [];
        const seen = new Set<string>();
        const add = (row: ProfileRow | null | undefined, role: string) => {
            if (!row || seen.has(row.id))
                return;
            seen.add(row.id);
            team.push(person(row, role));
        };
        add(p.pm, ROLE_TERMS.project_manager);
        add(p.client, ROLE_TERMS.client);
        for (const m of memberRows.filter((m) => m.project_id === p.id)) {
            const row = known.get(m.user_id);
            add(row, ROLE_TERMS[(m.role_in_project as UserRole) in ROLE_TERMS ? (m.role_in_project as UserRole) : (row?.role ?? "middleman")]);
        }
        teams[p.id] = team;
    }

    return { teams, unread: Object.fromEntries(ids.map((id, i) => [id, unreadCounts[i]])) };
}
