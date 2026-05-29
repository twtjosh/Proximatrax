import type { InquiryTriageRow } from "@/lib/inquiry-triage";
import { createClient } from "@/lib/supabase/server";
import { listInquirySummaries, listViewedInquiryIds } from "@/services/inquiry-service";
export const INQUIRY_SUMMARIES_TAG = "inquiry-summaries" as const;
export function inquiryViewsTag(profileId: string) {
    return `inquiry-views-${profileId}` as const;
}
export async function getSuperAdminInquirySummaries(): Promise<InquiryTriageRow[]> {
    const supabase = await createClient();
    return listInquirySummaries(supabase);
}
export async function getSuperAdminViewedInquiryIds(profileId: string): Promise<string[]> {
    const supabase = await createClient();
    return listViewedInquiryIds(profileId, supabase);
}
