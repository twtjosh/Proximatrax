import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient as createBrowserClient } from "@/lib/supabase/client";
import type { Inquiry, InquiryStatus } from "@/types/database";
import type { InquiryTriageRow } from "@/lib/inquiry-triage";
function resolveClient(client?: SupabaseClient): SupabaseClient {
    return client ?? createBrowserClient();
}
export async function submitInquiry(input: {
    name: string;
    email: string;
    message: string;
}, client?: SupabaseClient): Promise<Inquiry> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("inquiries")
        .insert({
        name: input.name.trim(),
        email: input.email.trim().toLowerCase(),
        message: input.message.trim(),
    })
        .select("*")
        .single();
    if (error)
        throw error;
    return data as Inquiry;
}
export async function listInquirySummaries(client?: SupabaseClient): Promise<InquiryTriageRow[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("inquiries")
        .select("id, status, name, email, created_at")
        .order("created_at", { ascending: false });
    if (error)
        throw error;
    return (data ?? []) as InquiryTriageRow[];
}
export async function listInquiries(client?: SupabaseClient, filters: {
    status?: InquiryStatus;
} = {}): Promise<Inquiry[]> {
    const sb = resolveClient(client);
    let query = sb
        .from("inquiries")
        .select("*")
        .order("created_at", { ascending: false });
    if (filters.status)
        query = query.eq("status", filters.status);
    const { data, error } = await query;
    if (error)
        throw error;
    return (data ?? []) as Inquiry[];
}
export async function listViewedInquiryIds(profileId: string, client?: SupabaseClient): Promise<string[]> {
    const sb = resolveClient(client);
    const { data, error } = await sb
        .from("inquiry_views")
        .select("inquiry_id")
        .eq("profile_id", profileId);
    if (error)
        throw error;
    return (data ?? []).map((row) => row.inquiry_id as string);
}
export async function markInquiryViewed(inquiryId: string, profileId: string, client: SupabaseClient): Promise<void> {
    const { error } = await client.from("inquiry_views").upsert({
        inquiry_id: inquiryId,
        profile_id: profileId,
        viewed_at: new Date().toISOString(),
    }, { onConflict: "inquiry_id,profile_id" });
    if (error)
        throw error;
}
export async function updateInquiryStatus(id: string, status: InquiryStatus, notes?: string, client?: SupabaseClient): Promise<Inquiry> {
    const sb = resolveClient(client);
    const payload: Record<string, unknown> = { status };
    if (notes !== undefined)
        payload.notes = notes;
    const { data, error } = await sb
        .from("inquiries")
        .update(payload)
        .eq("id", id)
        .select("*")
        .single();
    if (error)
        throw error;
    return data as Inquiry;
}
