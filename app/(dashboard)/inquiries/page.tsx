import { redirect } from "next/navigation";
import { Inbox } from "lucide-react";
import { stagger } from "@/components/dashboard/overview-kit";
import { InquiryInbox } from "@/components/superadmin/inquiry-inbox";
import { ROUTES } from "@/lib/constants";
import { getSuperAdminViewedInquiryIds } from "@/lib/data/inquiry-shell";
import { getViewer } from "@/lib/supabase/server";
import { listInquiries } from "@/services/inquiry-service";
import type { Inquiry, Profile } from "@/types/database";
export default async function InquiriesPage({ searchParams, }: {
    searchParams: Promise<{
        open?: string;
    }>;
}) {
    const { open: openInquiryId } = await searchParams;
    const { supabase, user, profile } = await getViewer();
    if (!user)
        redirect(ROUTES.LOGIN);
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
    const viewedInquiryIds = await getSuperAdminViewedInquiryIds(user.id).catch(() => []);
    if (loadError || inquiries.length === 0) {
        return (<div className="mx-auto w-full max-w-360 pb-10">
        <h1 className="materialize text-[2rem] leading-[1.05] font-semibold tracking-[-0.035em] text-ink sm:text-[2.5rem]">Inquiries</h1>
        <div className="materialize mt-6 grid min-h-[22rem] place-content-center rounded-[20px] px-6 py-16 text-center material" style={stagger(1)} role={loadError ? "alert" : undefined}>
          <span className={loadError ? "mx-auto grid size-14 place-items-center rounded-full bg-danger-soft text-danger" : "mx-auto grid size-14 place-items-center rounded-full bg-brand-soft text-brand"}>
            <Inbox className="size-6" strokeWidth={1.75} aria-hidden/>
          </span>
          <p className="mt-5 text-[17px] font-semibold tracking-[-0.016em] text-ink">
            {loadError ? "Inquiries couldn’t load" : "No inquiries yet"}
          </p>
          <p className="mx-auto mt-1.5 max-w-sm text-sm leading-relaxed text-ink-tertiary">
            {loadError
                ? "The connection to the database failed. Refresh the page; if it keeps happening, check the Supabase settings."
                : "When someone sends the “Get in touch” form on the public site, it lands here and the sidebar shows a count."}
          </p>
        </div>
      </div>);
    }
    return <InquiryInbox inquiries={inquiries} viewedInquiryIds={viewedInquiryIds} openInquiryId={typeof openInquiryId === "string" ? openInquiryId : undefined}/>;
}
