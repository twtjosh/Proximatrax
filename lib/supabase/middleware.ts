import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";
import { getRoleHomePath, ROUTES } from "@/lib/constants";
const WORKSPACE_LOGIN = "/login";
const FORGOT_PASSWORD = "/forgot-password";
const PROTECTED_PREFIXES = [
    "/dashboard",
    "/projects",
    "/activity",
    "/analytics",
    "/files",
    "/account",
    ROUTES.MESSAGES,
    ROUTES.MIDDLEMAN_HOME,
    "/inquiries",
    "/settings",
    // Needs the recovery session from the reset link; not an AUTH_ROUTE, so it isn't bounced home.
    ROUTES.UPDATE_PASSWORD,
] as const;
const SUPER_ADMIN_ONLY_PREFIXES = ["/settings", "/inquiries"] as const;
const AUTH_ROUTES = [WORKSPACE_LOGIN, FORGOT_PASSWORD] as const;
function getSupabaseEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return { supabaseUrl, supabaseAnonKey };
}
function matchesPrefix(pathname: string, prefixes: readonly string[]) {
    return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}
function isMiddlemanShellPath(pathname: string) {
    return (pathname === ROUTES.MIDDLEMAN_HOME ||
        pathname.startsWith(`${ROUTES.MIDDLEMAN_HOME}/`));
}
function middlemanForbiddenRedirect(pathname: string): string | null {
    if (pathname === "/projects/new" || pathname.startsWith("/projects/new/")) {
        return ROUTES.PROJECTS;
    }
    const hubs: {
        prefix: string;
        redirect: string;
    }[] = [
        { prefix: "/dashboard", redirect: ROUTES.MIDDLEMAN_HOME },
        { prefix: "/activity", redirect: ROUTES.MIDDLEMAN_HOME },
        { prefix: "/analytics", redirect: ROUTES.MIDDLEMAN_HOME },
        { prefix: "/files", redirect: ROUTES.MIDDLEMAN_HOME },
        { prefix: "/account", redirect: ROUTES.MIDDLEMAN_ACCOUNT },
    ];
    for (const { prefix, redirect } of hubs) {
        if (pathname === prefix || pathname.startsWith(`${prefix}/`)) {
            return redirect;
        }
    }
    return null;
}
function applyAuthCacheHeaders(response: NextResponse) {
    response.headers.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    response.headers.set("Pragma", "no-cache");
    response.headers.set("Expires", "0");
}
export async function updateSession(request: NextRequest) {
    let response = NextResponse.next({ request });
    const { pathname } = request.nextUrl;
    const isProtected = matchesPrefix(pathname, PROTECTED_PREFIXES);
    const isAuthRoute = matchesPrefix(pathname, AUTH_ROUTES);
    const isSuperAdminOnly = matchesPrefix(pathname, SUPER_ADMIN_ONLY_PREFIXES);
    const hasSupabaseEnv = Boolean(process.env.NEXT_PUBLIC_SUPABASE_URL) &&
        Boolean(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    if (!hasSupabaseEnv) {
        if (isProtected) {
            const url = request.nextUrl.clone();
            url.pathname = WORKSPACE_LOGIN;
            url.searchParams.set("next", pathname);
            const redirect = NextResponse.redirect(url);
            applyAuthCacheHeaders(redirect);
            return redirect;
        }
        if (isAuthRoute)
            applyAuthCacheHeaders(response);
        return response;
    }
    const { supabaseUrl, supabaseAnonKey } = getSupabaseEnv();
    const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return request.cookies.getAll();
            },
            setAll(cookiesToSet) {
                cookiesToSet.forEach(({ name, value }) => {
                    request.cookies.set(name, value);
                });
                response = NextResponse.next({ request });
                cookiesToSet.forEach(({ name, value, options }) => {
                    response.cookies.set(name, value, options);
                });
            },
        },
    });
    // Verifies the JWT locally with asymmetric signing keys (an Auth round-trip
    // otherwise) and refreshes an expired session, on every request.
    const { data: claimsData } = await supabase.auth.getClaims();
    const user = claimsData?.claims.sub ? { id: claimsData.claims.sub } : null;
    if (!user && isProtected) {
        const url = request.nextUrl.clone();
        url.pathname = WORKSPACE_LOGIN;
        url.searchParams.set("next", pathname);
        const redirect = NextResponse.redirect(url);
        applyAuthCacheHeaders(redirect);
        return redirect;
    }
    // Only some paths redirect by role; a project page or a prefetch shouldn't wait on a profile read for nothing.
    const needsRole = isAuthRoute || isSuperAdminOnly || isMiddlemanShellPath(pathname) || middlemanForbiddenRedirect(pathname) !== null;
    if (user && needsRole) {
        const { data: profile } = await supabase
            .from("profiles")
            .select("role")
            .eq("id", user.id)
            .maybeSingle();
        const role = (profile as {
            role?: string;
        } | null)?.role ?? null;
        const isSuperAdmin = role === "super_admin";
        const isMiddleman = role === "middleman";
        if (isMiddlemanShellPath(pathname) && !isMiddleman) {
            const url = request.nextUrl.clone();
            url.pathname = getRoleHomePath(role);
            url.search = "";
            return NextResponse.redirect(url);
        }
        if (isMiddleman) {
            const bounce = middlemanForbiddenRedirect(pathname);
            if (bounce) {
                const url = request.nextUrl.clone();
                url.pathname = bounce;
                url.search = "";
                return NextResponse.redirect(url);
            }
        }
        if (isSuperAdminOnly && !isSuperAdmin) {
            const url = request.nextUrl.clone();
            url.pathname = getRoleHomePath(role);
            url.search = "";
            return NextResponse.redirect(url);
        }
        if (isAuthRoute) {
            // Claims outlive a revoked session or a deleted profile, which the pages
            // reject (no profile); bouncing home then loops /dashboard <-> /login.
            // Confirm here and drop the stale cookies so the login page renders.
            const { data: { user: verified } } = await supabase.auth.getUser();
            if (!verified || !profile) {
                request.cookies.getAll()
                    .filter(({ name }) => name.startsWith("sb-"))
                    .forEach(({ name }) => response.cookies.delete(name));
                applyAuthCacheHeaders(response);
                return response;
            }
            const url = request.nextUrl.clone();
            url.pathname = getRoleHomePath(role);
            url.search = "";
            const redirect = NextResponse.redirect(url);
            applyAuthCacheHeaders(redirect);
            return redirect;
        }
    }
    if (isAuthRoute)
        applyAuthCacheHeaders(response);
    return response;
}
