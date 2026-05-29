import Link from "next/link";
import { redirect } from "next/navigation";
import { RoleBadge } from "@/components/shared/role-badge";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
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
export default async function AccountPage() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user)
        redirect(ROUTES.LOGIN);
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
    const resolved = profile as Profile | null;
    if (!resolved)
        redirect(ROUTES.LOGIN);
    if (resolved.role === "super_admin")
        redirect(ROUTES.DASHBOARD);
    return (<div className="mx-auto max-w-xl space-y-8">
      <header className="space-y-2">
        <p className="font-mono text-[10px] uppercase tracking-[0.22em] text-[#d97706]">
          Workspace
        </p>
        <h1 className="font-heading text-2xl tracking-tight text-slate-950">Account</h1>
        <p className="text-sm text-slate-600">
          Your identity in ProximaTrax. Role changes are handled by SuperAdmin provisioning.
        </p>
      </header>

      <section className="flex gap-4 border border-slate-200 bg-white p-6 shadow-sm">
        <Avatar className="h-16 w-16 shrink-0 rounded-sm border border-slate-200">
          {resolved.avatar_url ? (<AvatarImage src={resolved.avatar_url} alt=""/>) : null}
          <AvatarFallback className="rounded-sm bg-[#1e293b] text-lg text-white">
            {initials(resolved.full_name)}
          </AvatarFallback>
        </Avatar>
        <div className="min-w-0 space-y-2">
          <p className="font-heading text-xl tracking-tight text-slate-950">
            {resolved.full_name}
          </p>
          <RoleBadge role={resolved.role}/>
          <p className="break-all text-xs text-slate-500">{user.email}</p>
        </div>
      </section>

      <div className="flex flex-wrap gap-3">
        <Button render={<Link href={ROUTES.FORGOT_PASSWORD}/>} variant="outline" className="rounded-none">
          Reset password
        </Button>
        <Button render={<Link href={ROUTES.DASHBOARD}/>} variant="ghost" className="rounded-none">
          Back to dashboard
        </Button>
      </div>
    </div>);
}
