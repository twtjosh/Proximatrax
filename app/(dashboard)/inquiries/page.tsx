import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { InquiryInbox } from "@/components/superadmin/inquiry-inbox";
import { SuperAdminContentFrame } from "@/components/superadmin/super-admin-content-frame";
import { SuperAdminHero } from "@/components/superadmin/super-admin-hero";
import { ROUTES } from "@/lib/constants";
import { getSuperAdminViewedInquiryIds } from "@/lib/data/inquiry-shell";
import { createClient } from "@/lib/supabase/server";
import { listInquiries } from "@/services/inquiry-service";
import type { Inquiry, Profile } from "@/types/database";
export default async function InquiriesPage({ searchParams, }: {
    searchParams: Promise<{
        open?: string;
    }>;
}) {
    const { open: openInquiryId } = await searchParams;
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
    if (role !== "super_admin") {
        redirect(ROUTES.DASHBOARD);
    }
    let inquiries: Inquiry[] = [];
    let loadError = false;
    try {
        inquiries = await listInquiries(supabase);
    }
    catch {
        loadError = true;
    }
    let viewedInquiryIds: string[] = [];
    try {
        viewedInquiryIds = await getSuperAdminViewedInquiryIds(user.id);
    }
    catch {
        viewedInquiryIds = [];
    }
    return (<SuperAdminContentFrame className="space-y-6 sm:space-y-8">
      <SuperAdminHero icon={Inbox} eyebrow="Public website" title="Inquiry inbox"/>

      {loadError ? (<div className="rounded-2xl border border-rose-200 bg-rose-50 p-8 text-center shadow-md ring-1 ring-rose-500/10 dark:border-rose-500/30 dark:bg-rose-950/30 dark:shadow-lg" role="alert">
          <p className="text-sm font-medium text-rose-900 dark:text-rose-100">
            Unable to load inquiries.
          </p>
          <p className="mt-2 text-sm text-rose-800/90 dark:text-rose-200/80">
            Confirm Supabase is configured and the{" "}
            <code className="rounded-md bg-rose-100 px-2 py-0.5 font-mono text-xs text-rose-950 dark:bg-black/30 dark:text-rose-50">
              inquiries
            </code>{" "}
            table exists.
          </p>
        </div>) : inquiries.length === 0 ? (<div className="flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-slate-50/80 px-6 py-20 text-center ring-1 ring-slate-950/[0.04] dark:border-zinc-700/80 dark:bg-zinc-950/40 dark:ring-white/[0.03]">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-slate-200 bg-white text-slate-400 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-500">
            <Inbox className="h-7 w-7" strokeWidth={1.5} aria-hidden/>
          </div>
          <h2 className="mt-6 font-heading text-lg font-semibold text-slate-950 dark:text-white">
            No inquiries yet
          </h2>
          <p className="mt-2 max-w-md text-sm leading-relaxed text-slate-600 dark:text-zinc-500">
            When visitors use the &quot;Get in touch&quot; section on the public
            site, each submission will appear in this list with timestamp and
            status.
          </p>
        </div>) : (<InquiryInbox inquiries={inquiries} viewedInquiryIds={viewedInquiryIds} openInquiryId={typeof openInquiryId === "string" ? openInquiryId : undefined}/>)}
    </SuperAdminContentFrame>);
}
