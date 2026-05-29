import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleBadge } from "@/components/shared/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
function initials(name: string) {
    return name
        .split(" ")
        .map((p) => p[0])
        .join("")
        .slice(0, 2)
        .toUpperCase();
}
export default async function TeamDirectoryPage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const role = (profile as Pick<Profile, "role"> | null)?.role;
    if (role === "super_admin")
        redirect(ROUTES.DASHBOARD);
    const userIds = new Set<string>();
    if (role === "project_manager") {
        const { data: owned } = await supabase
            .from("projects")
            .select("id, client_id, pm_id")
            .eq("pm_id", user.id);
        for (const row of owned ?? []) {
            userIds.add(row.client_id);
            userIds.add(row.pm_id);
        }
        const projectIds = (owned ?? []).map((p) => p.id);
        if (projectIds.length > 0) {
            const { data: mems } = await supabase
                .from("project_members")
                .select("user_id")
                .in("project_id", projectIds);
            for (const m of mems ?? [])
                userIds.add(m.user_id);
        }
    }
    else if (role === "middleman" || role === "client") {
        const { data: memRows } = await supabase
            .from("project_members")
            .select("project_id")
            .eq("user_id", user.id);
        const memberProjectIds = (memRows ?? []).map((r) => r.project_id);
        const { data: clientProjects } = await supabase
            .from("projects")
            .select("id")
            .eq("client_id", user.id);
        const clientProjectIds = (clientProjects ?? []).map((r) => r.id);
        const projectIds = [...new Set([...memberProjectIds, ...clientProjectIds])];
        if (projectIds.length > 0) {
            const { data: projects } = await supabase
                .from("projects")
                .select("id, client_id, pm_id")
                .in("id", projectIds);
            for (const p of projects ?? []) {
                userIds.add(p.client_id);
                userIds.add(p.pm_id);
            }
            const { data: mems } = await supabase
                .from("project_members")
                .select("user_id")
                .in("project_id", projectIds);
            for (const m of mems ?? [])
                userIds.add(m.user_id);
        }
    }
    userIds.delete(user.id);
    let people: Profile[] = [];
    if (userIds.size > 0) {
        const { data: rows } = await supabase
            .from("profiles")
            .select("*")
            .in("id", Array.from(userIds))
            .order("full_name", { ascending: true });
        people = (rows ?? []) as Profile[];
    }
    return (<div className="space-y-6">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d97706]">
          Directory
        </p>
        <h1 className="font-heading text-2xl tracking-tight text-slate-950 sm:text-3xl">
          Team
        </h1>
        <p className="max-w-2xl text-sm text-slate-600">
          Everyone connected to the same active engagements as you — pulled from project
          membership, not the global SuperAdmin directory.
        </p>
      </header>

      {people.length === 0 ? (<div className="border border-dashed border-slate-200 bg-white p-10 text-center text-sm text-slate-500">
          No collaborators found yet. When you are assigned to projects, teammates appear here
          automatically.
        </div>) : (<div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {people.map((p) => (<div key={p.id} className="flex items-start gap-3 border border-slate-200 bg-white p-4 shadow-sm">
              <Avatar className="h-11 w-11 shrink-0 rounded-sm border border-slate-200">
                {p.avatar_url ? <AvatarImage src={p.avatar_url} alt=""/> : null}
                <AvatarFallback className="rounded-sm bg-[#1e293b] text-xs text-white">
                  {initials(p.full_name)}
                </AvatarFallback>
              </Avatar>
              <div className="min-w-0 flex-1 space-y-2">
                <p className="truncate font-medium text-slate-900">{p.full_name}</p>
                <RoleBadge role={p.role}/>
                <Link href={ROUTES.PROJECTS} className="inline-block font-mono text-[10px] uppercase tracking-[0.14em] text-[#9a4f02] hover:text-[#d97706]">
                  Shared projects
                </Link>
              </div>
            </div>))}
        </div>)}

      <p className="text-center text-xs text-slate-500">
        <Link href={ROUTES.PROJECTS} className="text-[#9a4f02] underline-offset-4 hover:underline">
          Browse projects
        </Link>{" "}
        to open a workspace tab (Board, Messages).
      </p>
    </div>);
}
