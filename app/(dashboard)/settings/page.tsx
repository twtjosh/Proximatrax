import { redirect } from "next/navigation";
import { Users } from "lucide-react";
import { SuperAdminContentFrame } from "@/components/superadmin/super-admin-content-frame";
import { SuperAdminHero } from "@/components/superadmin/super-admin-hero";
import { ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
import { CreateUserForm } from "./create-user-form";
import { UserDirectoryTable } from "./user-directory-table";
export default async function SettingsPage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
    const resolvedProfile = profile as Profile | null;
    const isSuperAdmin = resolvedProfile?.role === "super_admin";
    if (!isSuperAdmin) {
        redirect(ROUTES.DASHBOARD);
    }
    const { data: allProfiles } = await supabase
        .from("profiles")
        .select("*")
        .order("created_at", { ascending: false });
    const profiles = (allProfiles ?? []) as Profile[];
    return (<SuperAdminContentFrame>
      <SuperAdminHero icon={Users} eyebrow="Provisioning" title="User management" description="Create or remove workspace members with the correct role before they sign in. Every account appears in the directory below—use it as your source of truth for who has access."/>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg shadow-black/15 ring-1 ring-black/[0.04]">
        <div className="border-b border-zinc-100 bg-zinc-50/90 px-6 py-5">
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl border border-rose-200 bg-rose-50 text-rose-700">
              <Users className="h-5 w-5" strokeWidth={1.75} aria-hidden/>
            </div>
            <div>
              <h2 className="font-heading text-lg font-semibold tracking-tight text-zinc-950">
                Create new user
              </h2>
              <p className="mt-0.5 text-sm text-zinc-600">
                Invited people should change their password after first login.
              </p>
            </div>
          </div>
        </div>
        <div className="p-6 sm:p-8">
          <CreateUserForm />
        </div>
      </section>

      <section className="overflow-hidden rounded-2xl border border-zinc-200/90 bg-white shadow-lg shadow-black/15 ring-1 ring-black/[0.04]">
        <div className="flex flex-wrap items-end justify-between gap-4 border-b border-zinc-100 bg-zinc-50/90 px-6 py-5">
          <div>
            <h2 className="font-heading text-lg font-semibold tracking-tight text-zinc-950">
              Directory
            </h2>
            <p className="mt-1 text-sm text-zinc-600">
              {profiles.length} member{profiles.length === 1 ? "" : "s"} in the
              workspace
            </p>
          </div>
        </div>
        <UserDirectoryTable profiles={profiles} currentUserId={user.id}/>
      </section>
    </SuperAdminContentFrame>);
}
