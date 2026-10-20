import type { SupabaseClient } from "@supabase/supabase-js";
import { CLASSIFICATION_TERMS, ROLE_TERMS } from "@/lib/vocabulary";
import type { ProjectWithRelations } from "@/services/project-service";
import type { Profile } from "@/types/database";
import type { UserRole } from "@/types/enums";

export type TeamMember = {
    id: string;
    name: string;
    avatarUrl: string | null;
    /** Their part in this project, from the shared vocabulary. */
    role: string;
    /** What a middleman is called on site (Foreman…), shown in place of the role. */
    title?: string;
};

export type ProjectContext = {
    teams: Record<string, TeamMember[]>;
    /** Chat messages from others the viewer has not read yet, per project. */
    unread: Record<string, number>;
};

type ProfileRow = Pick<Profile, "id" | "full_name" | "avatar_url" | "role"> & Partial<Pick<Profile, "classification">>;
type MemberRow = { project_id: string; user_id: string; role_in_project: string; profile: ProfileRow | null };

/** What the context is built from, readable before the projects themselves arrive. */
export type ContextRows = { members: MemberRow[]; unread: Record<string, number> };

/**
 * Who works on each project and how many of its messages the viewer has not
 * read, in one round trip: members carry their profiles, and the chat inbox
 * (migration 0022) counts unread for every project at once. Without `ids` it
 * reads every project the viewer can see. It needs only ids, so callers start
 * it alongside the project read instead of after it. Both only decorate the
 * page, so a failed read yields empty context rather than an error.
 */
export async function loadProjectContext(supabase: SupabaseClient, ids?: string[]): Promise<ContextRows> {
    if (ids?.length === 0)
        return { members: [], unread: {} };
    let members = supabase.from("project_members").select("project_id, user_id, role_in_project, profile:profiles(id, full_name, avatar_url, role, classification)");
    if (ids)
        members = members.in("project_id", ids);
    const [memberResult, inbox] = await Promise.all([
        members,
        supabase.rpc("chat_inbox").then((r) => (r.data ?? []) as { project_id: string; unread: number }[], () => []),
    ]);
    return {
        members: (memberResult.data ?? []) as unknown as MemberRow[],
        unread: Object.fromEntries(inbox.map((r) => [r.project_id, r.unread ?? 0])),
    };
}

/** Each project's team (project manager, client, then members) and unread count. */
export function projectContext(projects: ProjectWithRelations[], rows: ContextRows): ProjectContext {
    const person = (row: ProfileRow, role: string): TeamMember => ({ id: row.id, name: row.full_name ?? "Unnamed", avatarUrl: row.avatar_url, role, title: row.classification ? CLASSIFICATION_TERMS[row.classification] : undefined });
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
        for (const m of rows.members.filter((m) => m.project_id === p.id))
            add(m.profile, ROLE_TERMS[(m.role_in_project as UserRole) in ROLE_TERMS ? (m.role_in_project as UserRole) : (m.profile?.role ?? "middleman")]);
        teams[p.id] = team;
    }
    return { teams, unread: Object.fromEntries(projects.map((p) => [p.id, rows.unread[p.id] ?? 0])) };
}
