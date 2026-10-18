import { cache } from "react";
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";
import type { Profile } from "@/types/database";
function getSupabaseServerEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return { supabaseUrl, supabaseAnonKey };
}
export async function createClient() {
    const cookieStore = await cookies();
    const { supabaseUrl, supabaseAnonKey } = getSupabaseServerEnv();
    return createServerClient(supabaseUrl, supabaseAnonKey, {
        cookies: {
            getAll() {
                return cookieStore.getAll();
            },
            setAll(cookiesToSet) {
                try {
                    cookiesToSet.forEach(({ name, value, options }) => {
                        cookieStore.set(name, value, options);
                    });
                }
                catch {
                }
            },
        },
    });
}
/**
 * The signed-in user and their profile. Cached per request, so the layouts
 * and page of one navigation share a single auth check and profile read.
 *
 * The session's JWT is verified locally against the project's signing keys
 * (cached by auth-js), like the proxy does, rather than asking the Auth server
 * on every render: that was a full round trip before any page data. A deleted
 * account still fails here, since it has no profile.
 */
export const getViewer = cache(async () => {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    const claims = data?.claims;
    const user = claims?.sub ? { id: claims.sub, email: typeof claims.email === "string" ? claims.email : undefined } : null;
    if (!user)
        return { supabase, user: null, profile: null };
    const { data: profile } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
    return { supabase, user, profile: profile as Profile | null };
});
