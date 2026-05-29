import { NextResponse } from "next/server";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const code = requestUrl.searchParams.get("code");
    if (!code) {
        return NextResponse.redirect(`${origin}${ROUTES.LOGIN}`);
    }
    const supabase = await createClient();
    const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(code);
    if (exchangeError) {
        return NextResponse.redirect(`${origin}${ROUTES.LOGIN}`);
    }
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.redirect(`${origin}${ROUTES.LOGIN}`);
    }
    const { data: profile } = await supabase
        .from("profiles")
        .select("role")
        .eq("id", user.id)
        .maybeSingle();
    const role = (profile as {
        role?: string;
    } | null)?.role ?? null;
    if (!role) {
        await supabase.auth.signOut();
        return NextResponse.redirect(`${origin}${ROUTES.LOGIN}`);
    }
    return NextResponse.redirect(`${origin}${getRoleHomePath(role)}`);
}
