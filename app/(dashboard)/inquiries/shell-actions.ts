"use server";
import { createClient } from "@/lib/supabase/server";
import { revalidateInquiryDashboardPaths } from "@/lib/revalidate-inquiry-dashboard";
export async function revalidateInquiryShellAction() {
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
    revalidateInquiryDashboardPaths();
    return { ok: true as const };
}
