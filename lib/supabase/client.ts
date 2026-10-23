import type { SupabaseClient } from "@supabase/supabase-js";
import { createBrowserClient } from "@supabase/ssr";
function getSupabaseBrowserEnv() {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
    if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY");
    }
    return { supabaseUrl, supabaseAnonKey };
}
/**
 * A dropped connection reads as plain words wherever it surfaces. The database
 * client words a failed request as `${name}: ${message}` (raw, "TypeError:
 * Failed to fetch"), so the name carries the headline. Its retries stay: on a
 * patchy site connection they are what let an action go through.
 */
const fetchWithPlainErrors: typeof fetch = async (input, init) => {
    try {
        return await fetch(input, init);
    }
    catch (e) {
        if (!(e instanceof TypeError))
            throw e;
        throw Object.assign(new Error("Check your connection and try again."), { name: navigator.onLine ? "Connection problem" : "You're offline" });
    }
};
export function createClient() {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();
    return createBrowserClient(supabaseUrl, supabaseAnonKey, { global: { fetch: fetchWithPlainErrors } });
}
/**
 * The signed-in user from the session JWT, verified locally against the
 * project's signing keys: no Auth server round trip before a write, which RLS
 * checks against the same token anyway.
 */
export async function signedInUser(sb: SupabaseClient): Promise<{ id: string } | null> {
    const { data } = await sb.auth.getClaims();
    const id = data?.claims.sub;
    return id ? { id } : null;
}
