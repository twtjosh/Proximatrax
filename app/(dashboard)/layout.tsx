import { redirect } from "next/navigation";
import { WorkspaceShell } from "@/components/shell/workspace-shell";
import { InquiryShellRealtimeSubscriber } from "@/components/superadmin/inquiry-shell-realtime-subscriber";
import { getSuperAdminInquirySummaries, getSuperAdminViewedInquiryIds, } from "@/lib/data/inquiry-shell";
import { ROUTES } from "@/lib/constants";
import type { InquiryTriageRow } from "@/lib/inquiry-triage";
import { getViewer } from "@/lib/supabase/server";
import type { Profile } from "@/types/database";
export const dynamic = "force-dynamic";
export default function DashboardLayout({ children, }: {
    children: React.ReactNode;
}) {
    return <ProtectedDashboardLayout>{children}</ProtectedDashboardLayout>;
}
async function ProtectedDashboardLayout({ children, }: {
    children: React.ReactNode;
}) {
    const { supabase, user, profile } = await getViewer();
    if (!user) {
        redirect(ROUTES.LOGIN);
    }
    if (!profile) {
        await supabase.auth.signOut();
        redirect(ROUTES.LOGIN);
    }
    const resolvedProfile = profile as Profile;
    const isSuperAdmin = resolvedProfile.role === "super_admin";
    let inquirySummaries: InquiryTriageRow[] | undefined;
    let viewedInquiryIds: string[] | undefined;
    if (isSuperAdmin) {
        [inquirySummaries, viewedInquiryIds] = await Promise.all([
            getSuperAdminInquirySummaries().catch(() => []),
            getSuperAdminViewedInquiryIds(user.id).catch(() => []),
        ]);
    }
    return (<WorkspaceShell profile={resolvedProfile} inquirySummaries={inquirySummaries} viewedInquiryIds={viewedInquiryIds}>
      {children}
      {isSuperAdmin ? <InquiryShellRealtimeSubscriber profileId={user.id}/> : null}
    </WorkspaceShell>);
}
