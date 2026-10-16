import { redirect } from "next/navigation";
import { PmAnalyticsView } from "@/components/analytics/pm-analytics";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { isoDateIn } from "@/lib/dashboard";
import { getViewer } from "@/lib/supabase/server";
import { loadPmAnalytics } from "@/services/analytics-service";
import type { Profile } from "@/types/database";

export default async function AnalyticsPage() {
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
    const me = profile as Profile | null;
    if (!me || me.role !== "project_manager")
        redirect(getRoleHomePath(me?.role));
    const today = isoDateIn(new Date());
    const data = await loadPmAnalytics(supabase, me, today);
    return <PmAnalyticsView data={data} viewer="pm" today={today}/>;
}
