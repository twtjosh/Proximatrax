import { NextResponse } from "next/server";
import type { EmailOtpType } from "@supabase/supabase-js";
import { getRoleHomePath, ROUTES, sanitizeNextPath } from "@/lib/constants";
import { createClient } from "@/lib/supabase/server";
export async function GET(request: Request) {
    const requestUrl = new URL(request.url);
    const origin = requestUrl.origin;
    const code = requestUrl.searchParams.get("code");
    // Email templates that link with {{ .TokenHash }} work on any device; a PKCE code only in the browser that asked.
    const tokenHash = requestUrl.searchParams.get("token_hash");
    const otpType = requestUrl.searchParams.get("type") as EmailOtpType | null;
    const next = sanitizeNextPath(requestUrl.searchParams.get("next"));
    const failure = next === ROUTES.UPDATE_PASSWORD ? `${ROUTES.FORGOT_PASSWORD}?error=link` : ROUTES.LOGIN;
    if (!code && !(tokenHash && otpType)) {
        return NextResponse.redirect(`${origin}${failure}`);
    }
    const supabase = await createClient();
    const { error: exchangeError } = code
        ? await supabase.auth.exchangeCodeForSession(code)
        : await supabase.auth.verifyOtp({ type: otpType!, token_hash: tokenHash! });
    if (exchangeError) {
        return NextResponse.redirect(`${origin}${failure}`);
    }
    const { data: { user }, } = await supabase.auth.getUser();
    if (!user) {
        return NextResponse.redirect(`${origin}${failure}`);
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
    return NextResponse.redirect(`${origin}${next ?? getRoleHomePath(role)}`);
}
