import { notFound, redirect } from "next/navigation";
import { ManagerProjectsView } from "@/components/analytics/manager-projects";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { isoDateIn } from "@/lib/dashboard";
import { getViewer } from "@/lib/supabase/server";
import { throwIfSupabaseError } from "@/lib/utils";
import { loadManagerProjects } from "@/services/analytics-service";
import type { Profile } from "@/types/database";

/** Profile ids are UUIDs; anything else would make Postgres throw instead of finding nothing. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** The super admin's page for one project manager: their active and completed projects, each opening read only. */
export default async function ManagerProjectsPage(props: { params: Promise<{ pmId: string }> }) {
    const { pmId } = await props.params;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const me = profile as Profile | null;
    if (!me || me.role !== "super_admin")
        redirect(getRoleHomePath(me?.role));
    if (!UUID.test(pmId))
        notFound();
    const { data: pm, error } = await supabase.from("profiles").select("id, full_name, role, avatar_url").eq("id", pmId).maybeSingle();
    throwIfSupabaseError(error);
    if (!pm || pm.role !== "project_manager")
        notFound();
    const today = isoDateIn(new Date());
    const data = await loadManagerProjects(supabase, pm, today);
    return <ManagerProjectsView data={data} today={today}/>;
}
