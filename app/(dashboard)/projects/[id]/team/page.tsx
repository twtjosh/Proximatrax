import { notFound, redirect } from "next/navigation";
import { UserRound } from "lucide-react";
import { RoleBadge } from "@/components/shared/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import { getProjectById } from "@/services/project-service";
import type { Profile } from "@/types/database";
function initials(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
export default async function ProjectTeamPage(props: {
    params: Promise<{
        id: string;
    }>;
}) {
    const { id } = await props.params;
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const project = await getProjectById(id, supabase);
    if (!project)
        notFound();
    const { data: memberRows } = await supabase
        .from("project_members")
        .select("user_id, role_in_project")
        .eq("project_id", id);
    type MemberRow = {
        user_id: string;
        role_in_project: string;
        profiles: Profile | null;
    };
    let members: MemberRow[] = [];
    if (memberRows && memberRows.length > 0) {
        const userIds = memberRows.map((m) => m.user_id);
        const { data: memberProfiles } = await supabase
            .from("profiles")
            .select("id, full_name, role, avatar_url")
            .in("id", userIds);
        const profileMap = new Map((memberProfiles ?? []).map((p) => [p.id, p]));
        members = memberRows.map((m) => ({
            ...m,
            profiles: (profileMap.get(m.user_id) as Profile | undefined) ?? null,
        }));
    }
    const core: Array<{
        label: string;
        profile: Profile | null;
    }> = [
        { label: "Project manager", profile: project.pm as Profile | null },
        { label: "Client", profile: project.client as Profile | null },
    ];
    return (<div className="space-y-6">
      <div>
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-slate-500">
          Delivery roster
        </p>
        <h2 className="font-heading text-lg tracking-tight text-slate-950">
          Team
        </h2>
        <p className="mt-1 max-w-2xl text-sm text-slate-600">
          Everyone with access to this operational workspace — leadership, field coordination, and
          client visibility.
        </p>
      </div>

      <section className="grid gap-4 md:grid-cols-2">
        {core.map((row) => (<div key={row.label} className="flex items-start gap-4 border border-slate-200 bg-white p-5 shadow-sm">
            <Avatar className="h-12 w-12 shrink-0 rounded-sm border border-slate-200">
              {row.profile?.avatar_url ? (<AvatarImage src={row.profile.avatar_url} alt=""/>) : null}
              <AvatarFallback className="rounded-sm bg-[#1e293b] text-sm text-white">
                {initials(row.profile?.full_name ?? "?")}
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0 flex-1 space-y-2">
              <p className="font-mono text-[10px] uppercase tracking-[0.2em] text-slate-500">
                {row.label}
              </p>
              <p className="font-heading text-lg tracking-tight text-slate-950">
                {row.profile?.full_name ?? "Unassigned"}
              </p>
              {row.profile?.role ? <RoleBadge role={row.profile.role}/> : null}
            </div>
          </div>))}
      </section>

      <section className="border border-slate-200 bg-white">
        <div className="border-b border-slate-100 bg-slate-50 px-5 py-4">
          <h3 className="font-heading text-base tracking-tight text-slate-950">
            Assigned coordinators
          </h3>
          <p className="mt-1 text-xs text-slate-600">
            Middlemen and specialists attached through{" "}
            <span className="font-medium">project members</span>.
          </p>
        </div>
        <div className="divide-y divide-slate-100">
          {members.length === 0 ? (<div className="flex items-center gap-3 px-5 py-8 text-sm text-slate-500">
              <UserRound className="h-5 w-5 text-slate-300"/>
              No additional members yet.
            </div>) : (members.map((m) => {
            const p = m.profiles;
            return (<div key={m.user_id} className="flex flex-wrap items-center gap-4 px-5 py-4">
                  <Avatar className="h-10 w-10 shrink-0 rounded-sm border border-slate-200">
                    {p?.avatar_url ? <AvatarImage src={p.avatar_url} alt=""/> : null}
                    <AvatarFallback className="rounded-sm bg-slate-800 text-xs text-white">
                      {initials(p?.full_name ?? "?")}
                    </AvatarFallback>
                  </Avatar>
                  <div className="min-w-0 flex-1">
                    <p className="font-medium text-slate-900">{p?.full_name ?? "Unknown"}</p>
                    <p className="font-mono text-[10px] uppercase tracking-[0.16em] text-slate-500">
                      {m.role_in_project}
                    </p>
                  </div>
                  {p?.role ? <RoleBadge role={p.role}/> : null}
                </div>);
        }))}
        </div>
      </section>
    </div>);
}
