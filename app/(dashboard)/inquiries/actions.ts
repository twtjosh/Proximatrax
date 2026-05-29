"use server";
import { revalidateInquiryDashboardPaths } from "@/lib/revalidate-inquiry-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/utils";
import { markInquiryViewed } from "@/services/inquiry-service";
export async function markInquiryViewedAction(inquiryId: string) {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { ok: false as const, error: "Unauthorized" };
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    if ((profile as {
        role?: string;
    } | null)?.role !== "super_admin") {
        return { ok: false as const, error: "Forbidden" };
    }
    try {
        await markInquiryViewed(inquiryId, user.id, supabase);
    }
    catch (e) {
        return { ok: false as const, error: getErrorMessage(e) };
    }
    revalidateInquiryDashboardPaths();
    return { ok: true as const };
}
