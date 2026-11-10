// UT-01 Authentication, UT-02 Roles and permissions, UT-03 Public inquiry.
import assert from "node:assert/strict";
import { kase } from "./helpers/harness.mjs";

const { fakeSupabase, setFake, jsonRequest } = await import("./helpers/stubs.mjs");
const { sanitizeNextPath, getRoleHomePath, ROLE_HOME_PATHS } = await import("@/lib/constants");
const { getErrorMessage } = await import("@/lib/utils");
const { login, sendPasswordReset } = await import("@/services/auth-service");
const { GET: authCallback } = await import("@/app/api/auth/callback/route");
const { updateSession } = await import("@/lib/supabase/middleware");
const { projectWorkspaceTabs } = await import("@/lib/project-view-policy");
const { validateStageTransition, nextHandoffAction } = await import("@/lib/board-workflow");
const adminUsers = await import("@/app/api/admin/users/route");
const adminUser = await import("@/app/api/admin/users/[userId]/route");
const inquiries = await import("@/app/api/inquiries/route");
const { INQUIRY_LIMITS, parseInquiry } = await import("@/lib/inquiry-input");
const { NextRequest } = await import("next/server");

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = "stub";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub";

const ORIGIN = "https://app.test";

// ─── UT-01 ──────────────────────────────────────────────────────────────────
let n = 0;
const id1 = () => `UT-01.${String(++n).padStart(2, "0")}`;

for (const value of ["https://evil.com", "http:evil.com", "//evil.com", "///evil.com", "/\\evil.com", "/\\/evil.com", "\\\\evil.com", "/a\tb", "/a\nb", "/a\rb", "javascript:alert(1)", "evil.com", "", null, undefined])
    kase(id1(), "sanitizeNextPath", "Reject a redirect target that leaves the site", JSON.stringify(value), "null", () => assert.equal(sanitizeNextPath(value), null));

for (const value of ["/%2F%2Fevil.com", "/%5Cevil.com", "/%09/evil.com", "/@evil.com", "/projects/1?x=//evil.com"])
    kase(id1(), "sanitizeNextPath", "An encoded path can't change the destination host", value, "Stays on the app's origin", () => {
        const next = sanitizeNextPath(value);
        assert.ok(next === null || new URL(next, ORIGIN).origin === ORIGIN, `${value} became ${next}`);
    });

for (const value of ["/login", "/login/x", "/forgot-password", "/forgot-password/x"])
    kase(id1(), "sanitizeNextPath", "Never return a signed-in user to a sign-in page", value, "null", () => assert.equal(sanitizeNextPath(value), null));

kase(id1(), "sanitizeNextPath", "Keep an ordinary in-app path", "/projects/1?tab=board", "Unchanged", () => assert.equal(sanitizeNextPath("/projects/1?tab=board"), "/projects/1?tab=board"));

kase(id1(), "login", "Normalize the address before signing in", "email ' PM@Test.COM '", "pm@test.com sent to Auth", async () => {
    const sb = fakeSupabase((q) => (q.table === "profiles" ? { data: { id: "u1", role: "project_manager" }, error: null } : null));
    setFake(sb);
    const r = await login({ email: " PM@Test.COM ", password: "secret123" });
    assert.equal(sb.calls[0].payload.email, "pm@test.com");
    assert.equal(r.redirectTo, "/dashboard");
});
kase(id1(), "login", "A rejected sign-in reaches the form as an error", "wrong password", "Throws Auth's error, reads no profile", async () => {
    const sb = fakeSupabase(undefined, { signIn: { data: { user: null }, error: new Error("Invalid login credentials") } });
    setFake(sb);
    await assert.rejects(login({ email: "a@b.co", password: "x" }), /Invalid login credentials/);
    assert.equal(sb.calls.filter((c) => c.table === "profiles").length, 0);
});
kase(id1(), "login", "A response with no user is an error, not a session", "Auth returns no user and no error", "Throws", async () => {
    setFake(fakeSupabase(undefined, { signIn: { data: { user: null }, error: null } }));
    await assert.rejects(login({ email: "a@b.co", password: "x" }), /Unable to sign in/);
});
kase(id1(), "sendPasswordReset", "The reset link returns through the auth callback", "email ' A@B.co '", "Lowercased address and callback redirect to /update-password", async () => {
    let seen;
    const sb = fakeSupabase();
    sb.auth.resetPasswordForEmail = async (email, opts) => {
        seen = { email, opts };
        return { error: null };
    };
    setFake(sb);
    globalThis.window = { location: { origin: ORIGIN } };
    await sendPasswordReset(" A@B.co ");
    delete globalThis.window;
    assert.equal(seen.email, "a@b.co");
    assert.equal(seen.opts.redirectTo, `${ORIGIN}/api/auth/callback?next=/update-password`);
});
for (const [input, want] of [[new Error("boom"), "boom"], ["plain", "plain"], [{ message: "db" }, "db"], [{ error_description: "desc" }, "desc"], [{}, "Something went wrong."], [null, "Something went wrong."]])
    kase(id1(), "getErrorMessage", "Map an error to words a person can read", JSON.stringify(input instanceof Error ? "Error(boom)" : input), JSON.stringify(want), () => assert.equal(getErrorMessage(input), want));

const callback = (qs) => authCallback(new Request(`${ORIGIN}/api/auth/callback${qs}`));
const roleResponder = (role) => (q) => (q.table === "profiles" ? { data: role ? { role } : null, error: null } : null);
kase(id1(), "GET /api/auth/callback", "No code goes to sign-in", "no parameters", "302 /login", async () => {
    setFake(fakeSupabase());
    assert.equal((await callback("")).headers.get("location"), `${ORIGIN}/login`);
});
kase(id1(), "GET /api/auth/callback", "A dead reset link explains itself", "next=/update-password, no code", "302 /forgot-password?error=link", async () => {
    setFake(fakeSupabase());
    assert.equal((await callback("?next=/update-password")).headers.get("location"), `${ORIGIN}/forgot-password?error=link`);
});
kase(id1(), "GET /api/auth/callback", "An expired or reused code doesn't sign in", "code, exchange fails", "302 /login", async () => {
    setFake(fakeSupabase(undefined, { exchangeError: new Error("expired") }));
    assert.equal((await callback("?code=x")).headers.get("location"), `${ORIGIN}/login`);
});
kase(id1(), "GET /api/auth/callback", "An account with no profile is signed back out", "valid code, no profile", "signOut called, 302 /login", async () => {
    const sb = fakeSupabase(roleResponder(null), { userId: "u1" });
    setFake(sb);
    assert.equal((await callback("?code=x")).headers.get("location"), `${ORIGIN}/login`);
    assert.ok(sb.calls.some((c) => c.op === "signOut"));
});
kase(id1(), "GET /api/auth/callback", "An external next is ignored after sign-in", "code, next=//evil.com, middleman", "302 /middleman", async () => {
    setFake(fakeSupabase(roleResponder("middleman"), { userId: "u1" }));
    assert.equal((await callback("?code=x&next=//evil.com")).headers.get("location"), `${ORIGIN}/middleman`);
});

const proxy = (path, sb) => {
    setFake(sb);
    return updateSession(new NextRequest(`${ORIGIN}${path}`));
};
for (const path of ["/dashboard", "/projects/abc", "/analytics", "/messages", "/middleman", "/inquiries", "/settings", "/files", "/account", "/activity", "/update-password"])
    kase(id1(), "updateSession", "An expired or missing session can't open a protected page", `anonymous GET ${path}`, "Redirect to /login with next, not cached", async () => {
        const res = await proxy(path, fakeSupabase());
        const to = new URL(res.headers.get("location"));
        assert.equal(to.pathname, "/login");
        assert.equal(to.searchParams.get("next"), path);
        assert.match(res.headers.get("cache-control"), /no-store/);
    });
for (const path of ["/", "/terms", "/data-retention", "/login", "/forgot-password"])
    kase(id1(), "updateSession", "Public pages stay open", `anonymous GET ${path}`, "No redirect", async () => assert.equal((await proxy(path, fakeSupabase())).headers.get("location"), null));
kase(id1(), "updateSession", "A prefix match doesn't catch a similar path", "anonymous GET /dashboards", "No redirect", async () => assert.equal((await proxy("/dashboards", fakeSupabase())).headers.get("location"), null));
kase(id1(), "updateSession", "A revoked session on the sign-in page clears cookies instead of looping", "claims valid, getUser fails, /login", "No redirect, sb- cookie deleted", async () => {
    const sb = fakeSupabase(roleResponder("client"), { userId: "u1", verified: false });
    setFake(sb);
    const res = await updateSession(new NextRequest(`${ORIGIN}/login`, { headers: { cookie: "sb-token=abc" } }));
    assert.equal(res.headers.get("location"), null);
    assert.match(res.headers.get("set-cookie") ?? "", /sb-token=;/);
});
kase(id1(), "updateSession", "A signed-in user is sent home from the sign-in page", "client at /login", "Redirect /dashboard", async () => {
    const res = await proxy("/login", fakeSupabase(roleResponder("client"), { userId: "u1" }));
    assert.equal(new URL(res.headers.get("location")).pathname, "/dashboard");
});

// ─── UT-02 ──────────────────────────────────────────────────────────────────
n = 0;
const id2 = () => `UT-02.${String(++n).padStart(2, "0")}`;

kase(id2(), "ROLE_HOME_PATHS", "Four working roles exist; the paper's five-role list is not the implementation", "keys of ROLE_HOME_PATHS", "super_admin, project_manager, middleman, client", () => assert.deepEqual(Object.keys(ROLE_HOME_PATHS).sort(), ["client", "middleman", "project_manager", "super_admin"]));
for (const [role, want] of [["super_admin", "/dashboard"], ["project_manager", "/dashboard"], ["middleman", "/middleman"], ["client", "/dashboard"], ["hacker", "/dashboard"], [null, "/dashboard"], [undefined, "/dashboard"], ["__proto__", "/dashboard"]])
    kase(id2(), "getRoleHomePath", "Known roles go home; unknown or malformed metadata gets the default", String(role), want, () => assert.equal(getRoleHomePath(role), want));
for (const [role, labels] of [["project_manager", ["Overview", "Tasks", "Timeline", "Files", "Team"]], ["client", ["Overview", "Updates", "Photos"]], ["middleman", ["Overview", "Schedule", "Photos"]], ["super_admin", ["Overview"]], ["unknown", ["Overview"]]])
    kase(id2(), "projectWorkspaceTabs", "Each role gets only its own project tabs", role, labels.join(", "), () => assert.deepEqual(projectWorkspaceTabs("p", role).map((t) => t.label), labels));
for (const role of ["middleman", "client", "super_admin"])
    kase(id2(), "validateStageTransition", "Only the project manager can accept work", `${role}, review to done`, "pm_only failure", () => {
        const r = validateStageTransition({ assigned_to: "x", checklist: [], description: null, stage: "review" }, "review", "done", role);
        assert.equal(r.ok, false);
        assert.equal(r.failures[0].code, "pm_only");
    });
kase(id2(), "nextHandoffAction", "A client has no task action at any stage", "client, every stage", "null", () => {
    for (const stage of ["to_do", "in_progress", "review", "done"])
        assert.equal(nextHandoffAction({ assigned_to: "c", checklist: [], description: null, stage }, "client", "c"), null);
});
kase(id2(), "nextHandoffAction", "Crew can't act on another person's task", "middleman, task assigned to someone else, in_progress", "null", () => assert.equal(nextHandoffAction({ assigned_to: "other", checklist: [], description: null, stage: "in_progress" }, "middleman", "me"), null));

const users = (callerRole, respond) => fakeSupabase((q) => (q.table === "profiles" && q.op === "select" ? { data: callerRole ? { role: callerRole } : null, error: null } : respond?.(q) ?? null), { userId: callerRole === undefined ? undefined : "caller" });
const post = (route, body) => route.POST(jsonRequest(`${ORIGIN}/api`, body));
const good = { email: "New@Test.io", password: "longenough", fullName: "New Person", role: "client" };

kase(id2(), "POST /api/admin/users", "An anonymous caller is refused", "no session", "401", async () => {
    setFake(users(undefined));
    assert.equal((await post(adminUsers, good)).status, 401);
});
for (const role of ["project_manager", "middleman", "client", null])
    kase(id2(), "POST /api/admin/users", "Only the super admin provisions accounts", `caller role ${role}`, "403", async () => {
        setFake(users(role));
        assert.equal((await post(adminUsers, good)).status, 403);
    });
for (const [what, body, want] of [["super_admin role", { ...good, role: "super_admin" }, 400], ["unknown role", { ...good, role: "owner" }, 400], ["short password", { ...good, password: "short" }, 400], ["missing email", { ...good, email: undefined }, 400], ["middleman without classification", { ...good, role: "middleman" }, 400], ["middleman with invalid classification", { ...good, role: "middleman", classification: "boss" }, 400], ["numeric email (regression D-12)", { ...good, email: 42 }, 400], ["array password (regression D-12)", { ...good, password: ["longenough"] }, 400], ["JSON null body (regression D-12)", "null", 400], ["malformed JSON", "{oops", 400]])
    kase(id2(), "POST /api/admin/users", "Bad provisioning input is refused cleanly", what, String(want), async () => {
        setFake(users("super_admin"));
        assert.equal((await post(adminUsers, body)).status, want);
    });
kase(id2(), "POST /api/admin/users", "A valid request creates the account with the role in app_metadata", "client account", "201 and profile upserted", async () => {
    const sb = users("super_admin", () => ({ data: null, error: null }));
    setFake(sb);
    const res = await post(adminUsers, good);
    assert.equal(res.status, 201);
    assert.equal(sb.calls.find((c) => c.op === "upsert").payload.role, "client");
});
kase(id2(), "POST /api/admin/users", "A failed profile write removes the half-made login", "profile upsert fails", "500, auth user deleted", async () => {
    const sb = users("super_admin", (q) => (q.op === "upsert" ? { data: null, error: { message: "nope" } } : null));
    setFake(sb);
    assert.equal((await post(adminUsers, good)).status, 500);
    assert.ok(sb.calls.some((c) => c.op === "deleteUser" && c.payload === "new-user"));
});

const del = (userId, body) => adminUser.DELETE(new Request(`${ORIGIN}/api`, { method: "DELETE", body: JSON.stringify(body ?? {}) }), { params: Promise.resolve({ userId }) });
const UUID = "11111111-1111-4111-8111-111111111111";
for (const [what, role, target, want] of [["anonymous", undefined, UUID, 401], ["project manager", "project_manager", UUID, 403], ["own account", "super_admin", "caller", 400], ["filter injection in the id", "super_admin", "x,role.eq.client", 404]])
    kase(id2(), "DELETE /api/admin/users/:id", "Account removal is restricted", what, String(want), async () => {
        setFake(users(role));
        assert.equal((await del(target)).status, want);
    });

// ─── UT-03 ──────────────────────────────────────────────────────────────────
n = 0;
const id3 = () => `UT-03.${String(++n).padStart(2, "0")}`;
const ok = { name: "Ana", email: "ana@mail.com", message: "A kitchen" };
const L = INQUIRY_LIMITS;

kase(id3(), "parseInquiry", "Whitespace is trimmed and the address lowercased", "' Ana ', ' ANA@Mail.COM ', ' A kitchen '", "Ana, ana@mail.com, A kitchen", () => assert.deepEqual(parseInquiry({ name: " Ana ", email: " ANA@Mail.COM ", message: " A kitchen " }), { ok: true, value: ok }));
for (const [what, body] of [["null body", null], ["string body", "text"], ["array body", []], ["empty object", {}], ["blank name", { ...ok, name: "  " }], ["blank email", { ...ok, email: "" }], ["blank message", { ...ok, message: "\n\t " }], ["numeric message", { ...ok, message: 42 }], ["array email", { ...ok, email: ["a@b.co"] }], ["object name", { ...ok, name: { a: 1 } }], ["no at sign", { ...ok, email: "not-an-email" }], ["no dot", { ...ok, email: "a@b" }], ["space in address", { ...ok, email: "a b@c.co" }], ["two at signs", { ...ok, email: "a@@b.co" }], [`name ${L.name + 1} chars`, { ...ok, name: "x".repeat(L.name + 1) }], [`message ${L.message + 1} chars`, { ...ok, message: "x".repeat(L.message + 1) }], [`email ${L.email + 1} chars`, { ...ok, email: `${"x".repeat(L.email)}@b.co` }]])
    kase(id3(), "parseInquiry", "Invalid input is refused", what, "ok: false", () => assert.equal(parseInquiry(body).ok, false));
for (const [what, body] of [[`name exactly ${L.name}`, { ...ok, name: "x".repeat(L.name) }], [`message exactly ${L.message}`, { ...ok, message: "x".repeat(L.message) }]])
    kase(id3(), "parseInquiry", "The limit itself is allowed", what, "ok: true", () => assert.equal(parseInquiry(body).ok, true));
kase(id3(), "parseInquiry", "Markup is kept as text; escaping is the renderer's job", "message containing a script tag", "Stored unchanged", () => assert.equal(parseInquiry({ ...ok, message: "<script>alert(1)</script>" }).value.message, "<script>alert(1)</script>"));

let ip = 0;
const inquire = (body, addr = `10.0.0.${++ip}`) => inquiries.POST(jsonRequest(`${ORIGIN}/api/inquiries`, body, { "x-real-ip": addr }));
const store = (count = 0) => fakeSupabase((q) => (q.op === "insert" ? { data: { id: "i1", created_at: "now" }, error: null } : q.table === "inquiries" ? { count, error: null } : null));

kase(id3(), "POST /api/inquiries", "A valid inquiry is stored", "valid body", "201, normalized row inserted", async () => {
    const sb = store();
    setFake(sb);
    const res = await inquire({ ...ok, email: "ANA@mail.com" });
    assert.equal(res.status, 201);
    assert.deepEqual(sb.calls.find((c) => c.op === "insert").payload, ok);
});
for (const [what, body] of [["malformed JSON", "{oops"], ["JSON null", "null"], ["missing fields", { name: "A" }]])
    kase(id3(), "POST /api/inquiries", "Bad input is a 400 and writes nothing", what, "400, no insert", async () => {
        const sb = store();
        setFake(sb);
        assert.equal((await inquire(body)).status, 400);
        assert.equal(sb.calls.length, 0);
    });
kase(id3(), "POST /api/inquiries", "Repeat submissions from one address are limited", "3 recent rows for the address", "429, no insert", async () => {
    const sb = store(3);
    setFake(sb);
    assert.equal((await inquire(ok)).status, 429);
    assert.equal(sb.calls.filter((c) => c.op === "insert").length, 0);
});
kase(id3(), "POST /api/inquiries", "Repeat submissions from one IP are limited", "4 requests from one IP", "201, 201, 201, 429", async () => {
    setFake(store());
    const codes = [];
    for (let i = 0; i < 4; i++)
        codes.push((await inquire({ ...ok, email: `a${i}@b.co` }, "203.0.113.9")).status);
    assert.deepEqual(codes, [201, 201, 201, 429]);
});
kase(id3(), "POST /api/inquiries", "A database failure doesn't leak details", "insert fails with a SQL message", "500, generic message", async () => {
    setFake(fakeSupabase((q) => (q.op === "insert" ? { data: null, error: { message: "relation secret_table" } } : { count: 0, error: null })));
    const res = await inquire(ok);
    assert.equal(res.status, 500);
    assert.doesNotMatch(JSON.stringify(await res.json()), /secret_table/);
});
