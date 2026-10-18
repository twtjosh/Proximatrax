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
export function createClient() {
    const { supabaseUrl, supabaseAnonKey } = getSupabaseBrowserEnv();
    return createBrowserClient(supabaseUrl, supabaseAnonKey);
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
