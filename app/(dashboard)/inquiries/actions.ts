"use server";
import { revalidateInquiryDashboardPaths } from "@/lib/revalidate-inquiry-dashboard";
import { createClient } from "@/lib/supabase/server";
import { getErrorMessage } from "@/lib/utils";
import { markInquiryViewed, updateInquiryStatus } from "@/services/inquiry-service";
import type { InquiryStatus } from "@/types/database";
const STATUSES: InquiryStatus[] = ["new", "contacted", "converted", "closed"];
async function superAdmin() {
    const supabase = await createClient();
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return { error: "Unauthorized" } as const;
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    if ((profile as {
        role?: string;
    } | null)?.role !== "super_admin") {
        return { error: "Forbidden" } as const;
    }
    return { supabase, user } as const;
}
export async function markInquiryViewedAction(inquiryId: string) {
    const auth = await superAdmin();
    if ("error" in auth) {
        return { ok: false as const, error: auth.error };
    }
    try {
        await markInquiryViewed(inquiryId, auth.user.id, auth.supabase);
    }
    catch (e) {
        return { ok: false as const, error: getErrorMessage(e) };
    }
    revalidateInquiryDashboardPaths();
    return { ok: true as const };
}
/** Moves an inquiry along (New → Contacted → Became a project or Closed) and saves its internal notes. */
export async function updateInquiryAction(inquiryId: string, status: InquiryStatus, notes: string) {
    if (!STATUSES.includes(status)) {
        return { ok: false as const, error: "Unknown status" };
    }
    const auth = await superAdmin();
    if ("error" in auth) {
        return { ok: false as const, error: auth.error };
    }
    try {
        await updateInquiryStatus(inquiryId, status, notes.trim() || null, auth.supabase);
    }
    catch (e) {
        return { ok: false as const, error: getErrorMessage(e) };
    }
    revalidateInquiryDashboardPaths();
    return { ok: true as const };
}
