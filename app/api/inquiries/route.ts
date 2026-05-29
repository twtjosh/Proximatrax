import { revalidateInquiryDashboardPaths } from "@/lib/revalidate-inquiry-dashboard";
import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
export async function POST(request: Request) {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseServiceKey) {
        return NextResponse.json({ error: "Server configuration error" }, { status: 500 });
    }
    const supabase = createClient(supabaseUrl, supabaseServiceKey);
    try {
        const body = await request.json();
        const { name, email, message } = body;
        if (!name?.trim() || !email?.trim() || !message?.trim()) {
            return NextResponse.json({ error: "Name, email, and message are required." }, { status: 400 });
        }
        const { data, error } = await supabase
            .from("inquiries")
            .insert({
            name: name.trim(),
            email: email.trim().toLowerCase(),
            message: message.trim(),
        })
            .select("id, created_at")
            .single();
        if (error)
            throw error;
        revalidateInquiryDashboardPaths();
        return NextResponse.json({ success: true, id: data.id }, { status: 201 });
    }
    catch {
        return NextResponse.json({ error: "Unable to submit inquiry. Please try again." }, { status: 500 });
    }
}
