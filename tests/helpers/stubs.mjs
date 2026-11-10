// Stands in for every module that would open a Supabase connection, so unit
// tests can't reach a real project. Tests set the client with `setFake`.
const current = { user: null, admin: null };
export const setFake = (user, admin = user) => Object.assign(current, { user, admin });

// @/lib/supabase/client and @/lib/supabase/server
export const createClient = (..._args) => (_args.length >= 2 ? current.admin : current.user);
export const signedInUser = async (sb) => {
    const { data } = await sb.auth.getClaims();
    return data?.claims.sub ? { id: data.claims.sub } : null;
};
export const subscribeAsViewer = () => undefined;
export const getViewer = async () => ({ user: null, profile: null });
// @supabase/ssr
export const createServerClient = () => current.user;
export const createBrowserClient = () => current.user;
// @/lib/revalidate-inquiry-dashboard
export const revalidateInquiryDashboardPaths = () => undefined;

/**
 * A chainable stand-in for the Supabase client. `respond` receives each
 * finished query ({ table, op, payload, filters }) and returns { data, error };
 * every query is kept in `calls` so a test can assert what was (not) written.
 */
export function fakeSupabase(respond = () => ({ data: null, error: null }), auth = {}) {
    const calls = [];
    const finish = (q) => {
        calls.push(q);
        return Promise.resolve(respond(q) ?? { data: null, error: null });
    };
    const builder = (q) => {
        const b = {
            then: (ok, bad) => finish(q).then(ok, bad),
            single: () => finish({ ...q, one: true }),
            maybeSingle: () => finish({ ...q, one: true }),
        };
        for (const op of ["select", "insert", "update", "delete", "upsert"])
            b[op] = (payload) => {
                if (op !== "select" || !q.op)
                    q.op = op;
                if (op !== "select")
                    q.payload = payload;
                return b;
            };
        for (const f of ["eq", "neq", "in", "is", "not", "gte", "lt", "ilike", "or", "order", "limit", "range"])
            b[f] = (...args) => {
                q.filters.push([f, ...args]);
                return b;
            };
        return b;
    };
    const sb = {
        calls,
        from: (table) => builder({ table, op: null, filters: [] }),
        rpc: (fn, args) => finish({ table: `rpc:${fn}`, op: "rpc", payload: args, filters: [] }),
        storage: {
            from: (bucket) => ({
                upload: (path) => finish({ table: `storage:${bucket}`, op: "upload", payload: path, filters: [] }),
                remove: (paths) => finish({ table: `storage:${bucket}`, op: "remove", payload: paths, filters: [] }),
            }),
        },
        auth: {
            getClaims: async () => ({ data: auth.userId ? { claims: { sub: auth.userId } } : null }),
            getUser: async () => ({ data: { user: auth.userId && auth.verified !== false ? { id: auth.userId } : null } }),
            signInWithPassword: async (creds) => {
                calls.push({ table: "auth", op: "signIn", payload: creds, filters: [] });
                return auth.signIn ?? { data: { user: { id: "u1" } }, error: null };
            },
            exchangeCodeForSession: async () => ({ error: auth.exchangeError ?? null }),
            verifyOtp: async () => ({ error: auth.exchangeError ?? null }),
            signOut: async () => {
                calls.push({ table: "auth", op: "signOut", filters: [] });
                return { error: null };
            },
            admin: {
                createUser: async () => auth.createUser ?? { data: { user: { id: "new-user" } }, error: null },
                deleteUser: async (id) => {
                    calls.push({ table: "auth", op: "deleteUser", payload: id, filters: [] });
                    return { error: null };
                },
            },
        },
    };
    return sb;
}

export const jsonRequest = (url, body, headers = {}) => new Request(url, { method: "POST", headers: { "content-type": "application/json", ...headers }, body: typeof body === "string" ? body : JSON.stringify(body) });
