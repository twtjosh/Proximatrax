// Runs against the real Supabase services of the staging project: Auth,
// PostgREST with real tokens, Realtime and Storage. Each user acts with their
// own session; the service role only finds and removes what the run created.
import { after, before } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { kase } from "../helpers/harness.mjs";
import { email, staging } from "./env.mjs";

const URL_ = staging.NEXT_PUBLIC_SUPABASE_URL, ANON = staging.NEXT_PUBLIC_SUPABASE_ANON_KEY;
const client = () => createClient(URL_, ANON, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = createClient(URL_, staging.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
const ROLES = ["admin", "pm", "crew1", "crew2", "client1", "client2"];
const s = {}, id = {};
const PROJECT = randomUUID();
const TITLE = `Staging run ${PROJECT.slice(0, 8)}`;
const latency = { taskMs: [], chatMs: [], bellMs: [] };
const channels = [];

const ok = ({ data, error }) => {
    assert.equal(error, null, error?.message);
    return data;
};
const refused = ({ data, error }) => assert.ok(error || !data || data.length === 0, `expected refusal, got ${JSON.stringify(data)}`);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

/** Subscribes `who` to a table and resolves once the channel has joined. */
async function listen(who, table, filter) {
    const events = [];
    let ready;
    const subscribed = new Promise((resolve) => (ready = resolve));
    const channel = s[who].channel(`${who}-${table}-${randomUUID()}`)
        .on("postgres_changes", { event: "*", schema: "public", table, ...(filter ? { filter } : {}) }, (e) => events.push({ at: Date.now(), e }))
        // SUBSCRIBED only means the socket joined; this is Realtime confirming the database listener exists.
        .on("system", {}, (m) => m.extension === "postgres_changes" && m.status === "ok" && ready());
    await new Promise((resolve, reject) => channel.subscribe((st, err) => (st === "SUBSCRIBED" ? resolve() : st === "CHANNEL_ERROR" || st === "TIMED_OUT" ? reject(err ?? new Error(st)) : undefined)));
    await Promise.race([subscribed, wait(15000).then(() => { throw new Error(`${who}: no postgres_changes confirmation`); })]);
    channels.push(channel);
    return { events, channel };
}
async function until(check, ms = 8000) {
    const end = Date.now() + ms;
    while (Date.now() < end) {
        if (check())
            return true;
        await wait(50);
    }
    return false;
}

before(async () => {
    for (const bucket of ["project-tasks", "project-chat"])
        ok(await admin.storage.updateBucket(bucket, { public: false }));
    for (const who of ROLES) {
        s[who] = client();
        const { data, error } = await s[who].auth.signInWithPassword({ email: email(who), password: staging.TEST_PASSWORD });
        assert.equal(error, null, `${who}: ${error?.message}`);
        id[who] = data.user.id;
        s[who].realtime.setAuth(data.session.access_token);
    }
});
after(async () => {
    await Promise.all(channels.map((c) => c.unsubscribe().catch(() => undefined)));
    const { data: files } = await admin.storage.from("project-tasks").list(PROJECT);
    for (const folder of files ?? []) {
        const { data: inner } = await admin.storage.from("project-tasks").list(`${PROJECT}/${folder.name}`);
        await admin.storage.from("project-tasks").remove((inner ?? []).map((f) => `${PROJECT}/${folder.name}/${f.name}`));
    }
    await admin.from("projects").delete().eq("id", PROJECT);
    for (const c of Object.values(s))
        c.realtime.disconnect();
    admin.realtime.disconnect();
});

kase("IT-02.S01", "Supabase Auth", "Each provisioned role signs in and reads its own profile with the right role", "6 accounts", "Roles match", async () => {
    const want = { admin: "super_admin", pm: "project_manager", crew1: "middleman", crew2: "middleman", client1: "client", client2: "client" };
    for (const who of ROLES)
        assert.equal(ok(await s[who].from("profiles").select("role").eq("id", id[who]).single()).role, want[who], who);
});
kase("IT-02.S02", "Supabase Auth", "A wrong password is refused", "pm, wrong password", "Auth error, no session", async () => {
    const r = await client().auth.signInWithPassword({ email: email("pm"), password: "wrong-password" });
    assert.ok(r.error);
    assert.equal(r.data.session, null);
});
kase("IT-02.S03", "Supabase Auth", "Public sign-up is off", "signUp with anon key", "Refused", async () => assert.ok((await client().auth.signUp({ email: `x${Date.now()}@proximatrax-test.com`, password: "long-enough-1" })).error));
kase("IT-13.S01", "Supabase Auth", "A session token refreshes", "refreshSession as pm", "New access token", async () => {
    const c = client();
    await c.auth.signInWithPassword({ email: email("pm"), password: staging.TEST_PASSWORD });
    const before = (await c.auth.getSession()).data.session.access_token;
    await wait(1100);
    const r = await c.auth.refreshSession();
    assert.equal(r.error, null);
    assert.notEqual(r.data.session.access_token, before);
});
kase("IT-13.S02", "PostgREST", "A forged token is refused", "garbage bearer token", "401", async () => {
    const r = await fetch(`${URL_}/rest/v1/tasks?select=id`, { headers: { apikey: ANON, authorization: "Bearer not.a.token" } });
    assert.equal(r.status, 401);
});
kase("IT-11.S01", "PostgREST as anon", "Anonymous API access returns nothing private", "anon key on 6 tables", "0 rows or refused", async () => {
    for (const t of ["projects", "tasks", "profiles", "chat_messages", "task_attachments", "inquiries"])
        refused(await client().from(t).select("*"));
});
kase("IT-01.S01", "PostgREST as anon", "A direct inquiry insert is refused", "anon insert", "Refused", async () => assert.ok((await client().from("inquiries").insert({ name: "x", email: "x@y.co", message: "m" })).error));

kase("IT-03.S01", "PostgREST invitations", "Project opens waiting on invitations; invitees can't see it yet", "pm creates; client1 and crew1 read", "pending_invites, invisible", async () => {
    ok(await s.pm.from("projects").insert({ id: PROJECT, title: TITLE, status: "pending_invites", client_id: id.client1, pm_id: id.pm, start_date: "2026-01-01", end_date: "2026-12-31" }));
    ok(await s.pm.from("project_invitations").insert([{ project_id: PROJECT, invitee_id: id.client1, invitee_role: "client", invited_by: id.pm, project_title: TITLE, status: "pending" }, { project_id: PROJECT, invitee_id: id.crew1, invitee_role: "middleman", invited_by: id.pm, project_title: TITLE, status: "pending" }]));
    assert.equal(ok(await s.client1.from("projects").select("id").eq("id", PROJECT)).length, 0);
    assert.equal(ok(await s.crew1.from("projects").select("id").eq("id", PROJECT)).length, 0);
});
kase("IT-03.S02", "PostgREST invitations", "Accepting activates the project and grants access", "client1 and crew1 accept", "planning, both can read", async () => {
    for (const [who, crew] of [["client1", false], ["crew1", true]]) {
        const inv = ok(await s[who].from("project_invitations").select("id").eq("project_id", PROJECT).eq("invitee_id", id[who]).single());
        if (crew)
            ok(await s[who].from("project_members").insert({ project_id: PROJECT, user_id: id[who], role_in_project: "middleman" }));
        ok(await s[who].from("project_invitations").update({ status: "accepted", responded_at: new Date().toISOString() }).eq("id", inv.id));
        ok(await s[who].rpc("activate_project_if_invites_accepted", { p_project_id: PROJECT }));
    }
    assert.equal(ok(await s.pm.from("projects").select("status").eq("id", PROJECT).single()).status, "planning");
    assert.equal(ok(await s.client1.from("projects").select("id").eq("id", PROJECT)).length, 1);
});
kase("IT-04.S01", "PostgREST tasks", "PM adds a phase and tasks; assignment persists", "pm inserts milestone and 2 tasks", "Saved, crew1 reads both", async () => {
    id.milestone = ok(await s.pm.from("milestones").insert({ project_id: PROJECT, title: "Handover", due_date: "2026-12-31" }).select("id").single()).id;
    const rows = ok(await s.pm.from("tasks").insert([{ project_id: PROJECT, milestone_id: id.milestone, title: "Install", stage: "to_do", assigned_to: id.crew1 }, { project_id: PROJECT, milestone_id: id.milestone, title: "Paint", stage: "to_do", assigned_to: id.crew1 }]).select("id, title"));
    id.task = rows.find((r) => r.title === "Install").id;
    id.task2 = rows.find((r) => r.title === "Paint").id;
    assert.equal(ok(await s.crew1.from("tasks").select("id").eq("project_id", PROJECT)).length, 2);
});
kase("IT-11.S02", "PostgREST with real tokens", "No access across projects", "crew2 and client2 read project; pm of none writes", "0 rows", async () => {
    for (const who of ["crew2", "client2"]) {
        assert.equal(ok(await s[who].from("projects").select("id").eq("id", PROJECT)).length, 0);
        assert.equal(ok(await s[who].from("tasks").select("id").eq("project_id", PROJECT)).length, 0);
        assert.equal(ok(await s[who].from("chat_messages").select("id").eq("project_id", PROJECT)).length, 0);
    }
});
kase("IT-07.S01", "PostgREST with real tokens", "A client sees no unaccepted work", "client1 selects tasks", "0 rows", async () => assert.equal(ok(await s.client1.from("tasks").select("id").eq("project_id", PROJECT)).length, 0));
kase("IT-11.S03", "PostgREST with real tokens", "Nobody promotes themselves", "crew1 sets own role", "Refused", async () => assert.ok((await s.crew1.from("profiles").update({ role: "super_admin" }).eq("id", id.crew1)).error));
kase("IT-11.S04", "RPC with real tokens", "A stranger can't send a notification", "client2 calls create_work_ready_notification", "Refused", async () => assert.ok((await s.client2.rpc("create_work_ready_notification", { p_user_id: id.crew1, p_task_id: id.task, p_project_id: PROJECT, p_title: "t", p_body: "b", p_href: "/x" })).error));
kase("IT-05.S01", "PostgREST + guard", "Crew start assigned work", "crew1 to_do to in_progress", "Saved", async () => ok(await s.crew1.from("tasks").update({ stage: "in_progress" }).eq("id", id.task).select("id").single()));
kase("IT-05.S02", "PostgREST + guard", "Submission without proof is refused by the real API", "crew1 in_progress to review, no photo", "Error", async () => assert.ok((await s.crew1.from("tasks").update({ stage: "review" }).eq("id", id.task)).error));

kase("IT-10.S01", "Supabase Storage", "Crew upload a photo into their project", "crew1, 1x1 PNG", "Object stored", async () => {
    id.path = `${PROJECT}/${id.task}/${randomUUID()}-site.png`;
    ok(await s.crew1.storage.from("project-tasks").upload(id.path, png, { contentType: "image/png" }));
});
kase("IT-10.S02", "Supabase Storage + PostgREST", "Metadata row matches the object", "crew1 inserts attachment", "Row saved", async () => {
    id.attachment = ok(await s.crew1.from("task_attachments").insert({ task_id: id.task, project_id: PROJECT, storage_path: id.path, file_name: "site.png", mime_type: "image/png", byte_size: png.length, media_kind: "photo", uploaded_by: id.crew1 }).select("id").single()).id;
});
kase("IT-10.S03", "Supabase Storage", "An outsider can't upload into the project", "crew2 upload", "Error", async () => assert.ok((await s.crew2.storage.from("project-tasks").upload(`${PROJECT}/x/${randomUUID()}.png`, png, { contentType: "image/png" })).error));
kase("IT-10.S04", "Supabase Storage", "A client can't upload site evidence", "client1 upload to project-tasks", "Error", async () => assert.ok((await s.client1.storage.from("project-tasks").upload(`${PROJECT}/x/${randomUUID()}.png`, png, { contentType: "image/png" })).error));
kase("IT-10.S05", "Supabase Storage", "The API won't list project files for an outsider", "crew2 lists folder", "Empty", async () => assert.equal(ok(await s.crew2.storage.from("project-tasks").list(`${PROJECT}/${id.task}`)).length, 0));
kase("IT-10.S06", "Supabase Storage", "Regression D-20: an object doesn't open by link with no session", "GET the old public URL, no auth", "Not 200", async () => assert.notEqual((await fetch(`${URL_}/storage/v1/object/public/project-tasks/${id.path}`)).status, 200));
kase("IT-10.S07", "Supabase Storage", "Oversized files are refused by the service", "51 MB upload", "Error", async () => assert.ok((await s.crew1.storage.from("project-tasks").upload(`${PROJECT}/${id.task}/${randomUUID()}.bin`, Buffer.alloc(51 * 1024 * 1024), { contentType: "application/octet-stream" })).error));
kase("IT-07.S02", "PostgREST with real tokens", "A client can't find the unapproved photo", "client1 selects attachments", "0 rows", async () => assert.equal(ok(await s.client1.from("task_attachments").select("id").eq("project_id", PROJECT)).length, 0));

kase("IT-08.S01", "Supabase Realtime", "A PM's task change reaches project crew, with latency measured (10 samples)", "pm updates a task 10 times; crew1 subscribed", "10 events delivered, no duplicates", async () => {
    const { events } = await listen("crew1", "tasks", `project_id=eq.${PROJECT}`);
    await wait(800);
    for (let i = 1; i <= 10; i++) {
        const n = events.length, sent = Date.now();
        ok(await s.pm.from("tasks").update({ position: 100 + i }).eq("id", id.task2).select("id").single());
        assert.ok(await until(() => events.length > n), `event ${i} not delivered`);
        latency.taskMs.push(events.at(-1).at - sent);
        assert.equal(events.length, n + 1, "duplicate event");
    }
});
kase("IT-08.S02", "Supabase Realtime", "A user without access receives nothing", "crew2 and client2 subscribed to tasks; pm updates", "0 events", async () => {
    const a = await listen("crew2", "tasks"), b = await listen("client2", "tasks");
    await wait(800);
    ok(await s.pm.from("tasks").update({ position: 200 }).eq("id", id.task2).select("id").single());
    await wait(3000);
    assert.equal(a.events.length + b.events.length, 0);
});
kase("IT-08.S03", "Supabase Realtime", "A client gets no event for unaccepted work", "client1 subscribed; pm updates open task", "0 events", async () => {
    const { events } = await listen("client1", "tasks");
    await wait(800);
    ok(await s.pm.from("tasks").update({ position: 300 }).eq("id", id.task2).select("id").single());
    await wait(3000);
    assert.equal(events.length, 0);
});
kase("IT-12.S01", "Realtime + notify trigger", "A submission rings the PM's bell live", "crew1 submits with photo; pm subscribed", "task_submitted event, stored row", async () => {
    const { events } = await listen("pm", "user_notifications", `user_id=eq.${id.pm}`);
    await wait(800);
    const sent = Date.now();
    ok(await s.crew1.from("tasks").update({ stage: "review" }).eq("id", id.task).select("id").single());
    assert.ok(await until(() => events.length > 0), "no live notification");
    latency.bellMs.push(events[0].at - sent);
    assert.equal(events[0].e.new.kind, "task_submitted");
});
kase("IT-07.S03", "Accept flow + Realtime", "Acceptance reaches the client live, with the approved photo", "pm accepts and approves; client1 subscribed", "Client event, then task and photo visible", async () => {
    const { events } = await listen("client1", "tasks", `project_id=eq.${PROJECT}`);
    await wait(800);
    const at = new Date().toISOString();
    ok(await s.pm.from("tasks").update({ stage: "done", client_visible_at: at }).eq("id", id.task).select("id").single());
    ok(await s.pm.from("task_attachments").update({ approved_for_client_at: at }).eq("task_id", id.task).select("id"));
    assert.ok(await until(() => events.length > 0), "client not notified live");
    assert.deepEqual(ok(await s.client1.from("tasks").select("id").eq("project_id", PROJECT)).map((t) => t.id), [id.task]);
    assert.equal(ok(await s.client1.from("task_attachments").select("id").eq("project_id", PROJECT)).length, 1);
});
kase("IT-09.S01", "Chat + Realtime", "Messages arrive live, once, in order (10 samples)", "client1 sends 10; pm subscribed", "10 events in send order", async () => {
    const { events } = await listen("pm", "chat_messages", `project_id=eq.${PROJECT}`);
    await wait(800);
    for (let i = 1; i <= 10; i++) {
        const n = events.length, sent = Date.now();
        ok(await s.client1.from("chat_messages").insert({ project_id: PROJECT, sender_id: id.client1, content: `m${i}` }).select("id").single());
        assert.ok(await until(() => events.length > n), `message ${i} not delivered`);
        latency.chatMs.push(events.at(-1).at - sent);
    }
    assert.deepEqual(events.map((x) => x.e.new.content), Array.from({ length: 10 }, (_, i) => `m${i + 1}`));
});
kase("IT-09.S02", "Chat + Realtime", "Simultaneous messages all persist", "crew1, client1, pm send at once", "3 new rows", async () => {
    const before = ok(await s.pm.from("chat_messages").select("id").eq("project_id", PROJECT)).length;
    await Promise.all([["crew1", "a"], ["client1", "b"], ["pm", "c"]].map(([who, content]) => s[who].from("chat_messages").insert({ project_id: PROJECT, sender_id: id[who], content })));
    assert.equal(ok(await s.pm.from("chat_messages").select("id").eq("project_id", PROJECT)).length, before + 3);
});
kase("IT-09.S03", "Chat + Realtime", "An outsider's subscription carries no messages", "client2 subscribed; client1 sends", "0 events", async () => {
    const { events } = await listen("client2", "chat_messages");
    await wait(800);
    ok(await s.client1.from("chat_messages").insert({ project_id: PROJECT, sender_id: id.client1, content: "private" }).select("id").single());
    await wait(3000);
    assert.equal(events.length, 0);
});
kase("IT-13.S03", "Realtime reconnect", "A dropped channel rejoins and later events arrive", "crew1 unsubscribes, a change happens, crew1 rejoins", "Missed change readable; next event delivered", async () => {
    const first = await listen("crew1", "tasks", `project_id=eq.${PROJECT}`);
    await first.channel.unsubscribe();
    ok(await s.pm.from("tasks").update({ title: "Paint walls" }).eq("id", id.task2).select("id").single());
    assert.equal(ok(await s.crew1.from("tasks").select("title").eq("id", id.task2).single()).title, "Paint walls");
    const again = await listen("crew1", "tasks", `project_id=eq.${PROJECT}`);
    await wait(800);
    ok(await s.pm.from("tasks").update({ position: 400 }).eq("id", id.task2).select("id").single());
    assert.ok(await until(() => again.events.length > 0), "no event after rejoin");
});
kase("IT-13.S04", "Membership + PostgREST", "A member removed mid-session loses access at once", "pm removes crew1", "crew1 reads 0 tasks", async () => {
    ok(await s.pm.from("tasks").update({ assigned_to: null }).eq("project_id", PROJECT).neq("stage", "done").select("id"));
    ok(await s.pm.from("project_members").delete().eq("project_id", PROJECT).eq("user_id", id.crew1).select("user_id"));
    const left = ok(await s.crew1.from("tasks").select("id, assigned_to").eq("project_id", PROJECT));
    assert.ok(left.every((t) => t.assigned_to === id.crew1), "only their own accepted work may remain");
    assert.equal(left.filter((t) => t.id === id.task2).length, 0);
});
kase("IT-10.S08", "Supabase Storage", "The uploader can delete their file", "crew1 removes own object", "Removed", async () => {
    const r = ok(await s.crew1.storage.from("project-tasks").remove([id.path]));
    assert.equal(r.length, 1);
});
kase("IT-08.S04", "Benchmark", "Records realtime latency (not pass/fail)", "samples from IT-08.S01, IT-09.S01, IT-12.S01", "Written to evidence", async () => {
    const { mkdirSync, writeFileSync } = await import("node:fs");
    const stat = (xs) => {
        const s2 = [...xs].sort((a, b) => a - b);
        return { samples: s2.length, medianMs: s2[s2.length >> 1], maxMs: s2.at(-1) };
    };
    mkdirSync("testing-reports/test-evidence/staging", { recursive: true });
    writeFileSync("testing-reports/test-evidence/staging/realtime-latency.json", JSON.stringify({ when: new Date().toISOString(), conditions: "Node client on this workstation to the Supabase free-tier test project", task: stat(latency.taskMs), chat: stat(latency.chatMs), notification: stat(latency.bellMs) }, null, 2));
    console.log(JSON.stringify({ task: stat(latency.taskMs), chat: stat(latency.chatMs), bell: stat(latency.bellMs) }));
});
