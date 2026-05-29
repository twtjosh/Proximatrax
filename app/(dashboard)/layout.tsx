import { redirect } from "next/navigation";
import { ClientHeader } from "@/components/client-portal/client-header";
import { ClientSidebar } from "@/components/client-portal/client-sidebar";
import { Header } from "@/components/layout/header";
import { MiddlemanWorkspaceShell } from "@/components/layout/middleman-workspace-shell";
import { PmWorkspaceShell } from "@/components/layout/pm-workspace-shell";
import { Sidebar } from "@/components/layout/sidebar";
import { InquiryShellRealtimeSubscriber } from "@/components/superadmin/inquiry-shell-realtime-subscriber";
import { getSuperAdminInquirySummaries, getSuperAdminViewedInquiryIds, } from "@/lib/data/inquiry-shell";
import { ROUTES } from "@/lib/constants";
import type { InquiryTriageRow } from "@/lib/inquiry-triage";
import { createClient } from "@/lib/supabase/server";
import { cn } from "@/lib/utils";
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
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        redirect(ROUTES.LOGIN);
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", user.id)
        .maybeSingle();
    if (!profile) {
        await supabase.auth.signOut();
        redirect(ROUTES.LOGIN);
    }
    const resolvedProfile = profile as Profile;
    const isSuperAdmin = resolvedProfile.role === "super_admin";
    const isMiddleman = resolvedProfile.role === "middleman";
    const isClient = resolvedProfile.role === "client";
    const isProjectManager = resolvedProfile.role === "project_manager";
    let inquirySummaries: InquiryTriageRow[] | undefined;
    let viewedInquiryIds: string[] | undefined;
    if (isSuperAdmin) {
        try {
            inquirySummaries = await getSuperAdminInquirySummaries();
        }
        catch {
            inquirySummaries = [];
        }
        try {
            viewedInquiryIds = await getSuperAdminViewedInquiryIds(user.id);
        }
        catch {
            viewedInquiryIds = [];
        }
    }
    if (isMiddleman) {
        return <MiddlemanWorkspaceShell profile={resolvedProfile}>{children}</MiddlemanWorkspaceShell>;
    }
    if (isProjectManager) {
        return <PmWorkspaceShell profile={resolvedProfile}>{children}</PmWorkspaceShell>;
    }
    if (isClient) {
        return (<div className="h-svh overflow-hidden bg-[#f5f5f4] bg-[radial-gradient(ellipse_100%_60%_at_50%_-10%,rgba(245,158,11,0.06),transparent_50%)]">
        <div className="flex h-full min-h-0">
          <ClientSidebar profile={resolvedProfile}/>
          <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
            <ClientHeader profile={resolvedProfile}/>
            <main className="flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto px-4 py-6 sm:px-6 sm:py-8 lg:px-10 lg:py-10">
              {children}
            </main>
          </div>
        </div>
      </div>);
    }
    return (<div className={cn("h-svh overflow-hidden", isSuperAdmin
            ? "bg-zinc-50 bg-[radial-gradient(ellipse_120%_80%_at_50%_-8%,rgba(244,63,94,0.06),transparent_55%)] dark:bg-[#030712] dark:bg-[radial-gradient(ellipse_120%_80%_at_50%_-8%,rgba(244,63,94,0.055),transparent_52%)]"
            : isProjectManager
                ? "bg-background"
                : "bg-background")}>
      <div className="flex h-full min-h-0">
        <Sidebar profile={resolvedProfile} inquirySummaries={inquirySummaries} viewedInquiryIds={viewedInquiryIds}/>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
          <Header profile={resolvedProfile} inquirySummaries={inquirySummaries} viewedInquiryIds={viewedInquiryIds}/>
          <main className={cn("flex min-h-0 min-w-0 flex-1 flex-col overflow-y-auto", isSuperAdmin
            ? "px-4 py-4 sm:px-6 sm:py-5 md:px-8 md:py-6"
            : isProjectManager
                ? "p-5"
                : "p-5")}>
            {children}
          </main>
        </div>
      </div>
      {isSuperAdmin ? <InquiryShellRealtimeSubscriber profileId={user.id}/> : null}
    </div>);
}
