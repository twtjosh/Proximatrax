import type { RealtimeChannel, SupabaseClient } from "@supabase/supabase-js";
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
/** Re-read the session's token this often: the server refreshes it in the cookies without telling realtime. */
const REALTIME_TOKEN_MS = 4 * 60_000;
let realtimeAuth: Promise<void> | null = null;
/**
 * Subscribes once realtime carries the signed-in user's token. A channel that
 * joins before the session has loaded (the shell mounts first on a reload)
 * joins anonymously, and row-level security then filters out every event: the
 * page looks live but never updates. Later the token is re-read on a timer and
 * whenever the tab comes back, so it never expires under an open page.
 */
export function subscribeAsViewer(sb: SupabaseClient, channel: RealtimeChannel, callback?: Parameters<RealtimeChannel["subscribe"]>[0]): RealtimeChannel {
    realtimeAuth ??= startRealtimeAuth(sb);
    // Unmounted while waiting: removeChannel already dropped it, and subscribing would bring it back.
    void realtimeAuth.then(() => sb.getChannels().includes(channel) && channel.subscribe(callback));
    return channel;
}
function startRealtimeAuth(sb: SupabaseClient): Promise<void> {
    // No token argument: realtime reads the current session each time, so a refresh anywhere reaches it.
    const sync = () => sb.realtime.setAuth().catch(() => undefined);
    setInterval(() => void sync(), REALTIME_TOKEN_MS);
    document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible")
            void sync();
    });
    return sync();
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
