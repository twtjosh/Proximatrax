// IT-01 to IT-14: the app's real migrations on an isolated PostgreSQL, exercised
// as individual signed-in users. What needs the Supabase services themselves
// (Auth, Realtime delivery, the Storage API) is reported BLOCKED, not assumed.
import assert from "node:assert/strict";
import { blocked, kase } from "../helpers/harness.mjs";
import { as, denied, freshDb, isolated, seed } from "./helpers/db.mjs";

const pg = await freshDb();
const { u, p, m, t, a, f } = await seed(pg);
const su = async (sql, params) => (await pg.query(sql, params)).rows;
const one = async (sql, params) => (await su(sql, params))[0];
const it = (id, fn, purpose, input, expected, body) => kase(id, fn, purpose, input, expected, () => isolated(pg, body));
const seq = (prefix) => {
    let n = 0;
    return () => `${prefix}.${String(++n).padStart(2, "0")}`;
};
const NEEDS_SUPABASE = "needs a dedicated Supabase test project (Auth, Realtime and Storage services); none is configured, and the only configured project is production";
const refused = async (who, sql, params) => assert.equal(await denied(pg, who, sql, params), true, "expected this to be refused");
const stage = async (id) => (await one("select stage from tasks where id = $1", [id])).stage;
const newUser = async (id, role) => {
    await pg.query("insert into auth.users (id, email, raw_app_meta_data) values ($1, $2, $3)", [id, `${id}@test.invalid`, { role }]);
    return id;
};
const OUT1 = "00000000-0000-4000-8000-000000000901";
const proof = (taskId, by = u.crew1, project = p.one) => su(`insert into task_attachments (task_id, project_id, storage_path, file_name, mime_type, byte_size, media_kind, uploaded_by) values ($1, $2, 'x/y/z.jpg', 'z.jpg', 'image/jpeg', 1, 'photo', $3)`, [taskId, project, by]);
const move = (who, id, to) => as(pg, who, "update tasks set stage = $1 where id = $2", [to, id]);

// ─── IT-01 ──────────────────────────────────────────────────────────────────
const i1 = seq("IT-01");
it(i1(), "inquiries + super admin", "Administrator reads an inquiry and updates its status; the change persists", "super admin selects, sets status", "Row visible, status saved", async () => {
    const { rows } = await as(pg, u.admin, "select id from inquiries");
    assert.equal(rows.length, 1);
    await as(pg, u.admin, "update inquiries set status = 'in_review' where id = $1", [rows[0].id]);
    assert.equal((await one("select status from inquiries where id = $1", [rows[0].id])).status, "in_review");
});
for (const who of ["anon", "pm1", "crew1", "client1"])
    it(i1(), "inquiries RLS", "Inquiries are private to the super admin", `${who} selects inquiries`, "No rows", async () => assert.equal((await as(pg, u[who] ?? null, "select * from inquiries")).rows.length, 0));
for (const who of ["anon", "client1"])
    it(i1(), "inquiries RLS", "Regression D-10: nobody writes around the validated API route", `${who} inserts directly with a forged status`, "Refused", () => refused(u[who] ?? null, "insert into inquiries (name, email, message, status) values ('x', 'x@y.co', 'spam', 'closed')"));
it(i1(), "inquiries RLS", "Only the super admin changes status", "PM updates", "No row changed", () => refused(u.pm1, "update inquiries set status = 'closed'"));

// ─── IT-02 ──────────────────────────────────────────────────────────────────
const i2 = seq("IT-02");
it(i2(), "auth.users + handle_new_user", "A provisioned identity gets a matching profile and role", "app_metadata role middleman, full_name Ana", "Profile with both", async () => {
    await pg.query("insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values ($1, 'a@t.invalid', $2, $3)", [OUT1, { role: "middleman" }, { full_name: "Ana" }]);
    assert.deepEqual(await one("select role, full_name from profiles where id = $1", [OUT1]), { role: "middleman", full_name: "Ana" });
});
it(i2(), "auth.users + handle_new_user", "A role chosen at sign-up is ignored", "user_metadata role super_admin", "Profile is a client", async () => {
    await pg.query("insert into auth.users (id, email, raw_user_meta_data) values ($1, 'b@t.invalid', $2)", [OUT1, { role: "super_admin" }]);
    assert.equal((await one("select role from profiles where id = $1", [OUT1])).role, "client");
});
it(i2(), "auth.users + handle_new_user", "Invalid role metadata leaves no half-made account", "app_metadata role owner", "Insert fails, no identity remains", async () => {
    await pg.exec("savepoint s");
    await assert.rejects(pg.query("insert into auth.users (id, email, raw_app_meta_data) values ($1, 'c@t.invalid', $2)", [OUT1, { role: "owner" }]));
    await pg.exec("rollback to savepoint s");
    assert.equal((await su("select 1 from auth.users where id = $1", [OUT1])).length, 0);
});
it(i2(), "profiles RLS", "Nobody inserts a staff profile for themselves", "new login inserts super_admin profile", "Refused", async () => {
    await newUser(OUT1, "client");
    await su("delete from profiles where id = $1", [OUT1]);
    await refused(OUT1, "insert into profiles (id, role) values ($1, 'super_admin')", [OUT1]);
});
it(i2(), "auth.users + profiles", "Removing an identity removes its profile", "delete auth user", "Profile gone", async () => {
    await newUser(OUT1, "client");
    await su("delete from auth.users where id = $1", [OUT1]);
    assert.equal((await su("select 1 from profiles where id = $1", [OUT1])).length, 0);
});
it(i2(), "profiles + RLS", "A login whose profile is gone has no access", "crew profile deleted, token still valid", "No project, no task", async () => {
    await su("delete from project_members where user_id = $1", [u.crew1]);
    await su("update tasks set assigned_to = null where assigned_to = $1", [u.crew1]);
    await su("delete from task_attachments where uploaded_by = $1", [u.crew1]);
    await su("delete from task_comments where author_id = $1", [u.crew1]);
    await su("delete from chat_messages where sender_id = $1", [u.crew1]);
    await su("delete from profiles where id = $1", [u.crew1]);
    assert.equal((await as(pg, u.crew1, "select id from projects")).rows.length, 0);
    assert.equal((await as(pg, u.crew1, "select id from tasks")).rows.length, 0);
});
blocked(i2(), "Supabase Auth admin API", "Real provisioning, sign-in, invitation email, revoked session", NEEDS_SUPABASE);

// ─── IT-03 ──────────────────────────────────────────────────────────────────
const i3 = seq("IT-03");
const P3 = "00000000-0000-4000-8000-000000000103";
const openProject = async (pm = u.pm1, client = u.client2, crew = u.crew2) => {
    await as(pg, pm, `insert into projects (id, title, status, client_id, pm_id, start_date, end_date) values ($1, 'New', 'pending_invites', $2, $3, '2026-01-01', '2026-02-01')`, [P3, client, pm]);
    await as(pg, pm, `insert into project_invitations (project_id, invitee_id, invitee_role, status, invited_by, project_title) values ($1, $2, 'client', 'pending', $3, 'New'), ($1, $4, 'middleman', 'pending', $3, 'New')`, [P3, client, pm, crew]);
};
const inviteOf = async (who) => (await one("select id from project_invitations where project_id = $1 and invitee_id = $2", [P3, who])).id;
const accept = async (who, crew) => {
    const id = await inviteOf(who);
    if (crew)
        await as(pg, who, "insert into project_members (project_id, user_id, role_in_project) values ($1, $2, 'middleman')", [P3, who]);
    await as(pg, who, "update project_invitations set status = 'accepted', responded_at = now() where id = $1 and invitee_id = $2 and status = 'pending'", [id, who]);
    await as(pg, who, "select activate_project_if_invites_accepted($1)", [P3]);
};
const status = async () => (await one("select status from projects where id = $1", [P3])).status;

it(i3(), "projects + project_invitations", "A PM opens a project waiting on invitations, and the owner is correct", "PM inserts project and 2 invitations", "pending_invites, pm_id is the caller, 2 pending", async () => {
    await openProject();
    assert.equal(await status(), "pending_invites");
    assert.equal((await one("select pm_id from projects where id = $1", [P3])).pm_id, u.pm1);
    assert.equal((await su("select 1 from project_invitations where project_id = $1 and status = 'pending'", [P3])).length, 2);
});
it(i3(), "projects RLS", "A PM can't create a project owned by another PM", "pm1 inserts pm_id pm2", "Refused", () => refused(u.pm1, `insert into projects (title, client_id, pm_id, start_date, end_date) values ('x', $1, $2, '2026-01-01', '2026-02-01')`, [u.client1, u.pm2]));
for (const who of ["crew1", "client1"])
    it(i3(), "projects RLS", "Only staff with authority create projects", `${who} inserts a project`, "Refused", () => refused(u[who], `insert into projects (title, client_id, pm_id, start_date, end_date) values ('x', $1, $2, '2026-01-01', '2026-02-01')`, [u.client1, u[who]]));
it(i3(), "projects constraint", "The database refuses reversed dates", "end before start", "Refused", () => refused(u.pm1, `insert into projects (title, client_id, pm_id, start_date, end_date) values ('x', $1, $2, '2026-02-01', '2026-01-01')`, [u.client1, u.pm1]));
for (const who of ["client2", "crew2"])
    it(i3(), "user_can_select_project_row", "An invitee sees nothing of the project before accepting", `${who}, invitation pending`, "No project row", async () => {
        await openProject();
        assert.equal((await as(pg, u[who], "select 1 from projects where id = $1", [P3])).rows.length, 0);
    });
it(i3(), "invitation accept flow", "One acceptance doesn't activate the project", "client accepts, crew pending", "Still pending_invites", async () => {
    await openProject();
    await accept(u.client2);
    assert.equal(await status(), "pending_invites");
});
it(i3(), "invitation accept flow", "All accepted: project activates, membership and access follow", "client and crew accept", "planning, crew is a member, both can read", async () => {
    await openProject();
    await accept(u.client2);
    await accept(u.crew2, true);
    assert.equal(await status(), "planning");
    assert.equal((await su("select 1 from project_members where project_id = $1 and user_id = $2", [P3, u.crew2])).length, 1);
    for (const who of [u.client2, u.crew2])
        assert.equal((await as(pg, who, "select 1 from projects where id = $1", [P3])).rows.length, 1);
});
it(i3(), "invitation decline", "Declining gives no access and doesn't activate", "client declines", "No access, still pending_invites", async () => {
    await openProject();
    await as(pg, u.client2, "update project_invitations set status = 'declined' where id = $1", [await inviteOf(u.client2)]);
    assert.equal((await as(pg, u.client2, "select 1 from projects where id = $1", [P3])).rows.length, 0);
    assert.equal(await status(), "pending_invites");
});
it(i3(), "project_invitations RLS", "Nobody answers someone else's invitation", "client1 accepts client2's invitation", "No row changed", async () => {
    await openProject();
    await refused(u.client1, "update project_invitations set status = 'accepted' where id = $1", [await inviteOf(u.client2)]);
});
it(i3(), "project_invitations constraint", "One person can't be invited to a project twice", "second invitation, same person", "Refused", async () => {
    await openProject();
    await refused(u.pm1, `insert into project_invitations (project_id, invitee_id, invitee_role, status, invited_by, project_title) values ($1, $2, 'client', 'pending', $3, 'New')`, [P3, u.client2, u.pm1]);
});
it(i3(), "project_invitations RLS", "A PM can't invite into another PM's project", "pm2 invites to project one", "Refused", () => refused(u.pm2, `insert into project_invitations (project_id, invitee_id, invitee_role, status, invited_by, project_title) values ($1, $2, 'middleman', 'pending', $3, 'x')`, [p.one, u.crew2, u.pm2]));
it(i3(), "project_invitations guard", "Regression D-09: answering can't re-point the invitation", "invitee sets project_id to another project while accepting", "Refused, row unchanged", async () => {
    await openProject();
    const id = await inviteOf(u.client2);
    await refused(u.client2, "update project_invitations set status = 'accepted', project_id = $1 where id = $2", [p.two, id]);
    assert.equal((await one("select project_id from project_invitations where id = $1", [id])).project_id, P3);
});
it(i3(), "project_members RLS", "Membership can't be taken without an invitation", "crew2 inserts self into project one", "Refused", () => refused(u.crew2, "insert into project_members (project_id, user_id) values ($1, $2)", [p.one, u.crew2]));

// ─── IT-04 ──────────────────────────────────────────────────────────────────
const i4 = seq("IT-04");
const addTask = (who, project, extra = {}) => as(pg, who, `insert into tasks (project_id, title, stage, assigned_to, milestone_id) values ($1, 'New', 'to_do', $2, $3) returning id`, [project, extra.assigned_to ?? null, extra.milestone_id ?? null]);
it(i4(), "tasks + projects", "A PM adds and assigns a task; the assignment persists", "pm1 assigns crew1", "Row saved with assignee", async () => {
    const { rows } = await addTask(u.pm1, p.one, { assigned_to: u.crew1, milestone_id: m.one });
    assert.equal((await one("select assigned_to from tasks where id = $1", [rows[0].id])).assigned_to, u.crew1);
});
it(i4(), "tasks + project_members", "Crew see their project's tasks and no one else's", "crew1 reads tasks", "Project one only", async () => {
    const { rows } = await as(pg, u.crew1, "select distinct project_id from tasks");
    assert.deepEqual(rows.map((r) => r.project_id), [p.one]);
});
it(i4(), "tasks constraint", "No orphan task", "project_id that doesn't exist, as superuser", "Refused by the foreign key", async () => {
    await pg.exec("savepoint s");
    await assert.rejects(su("insert into tasks (project_id, title) values ($1, 'x')", [OUT1]));
    await pg.exec("rollback to savepoint s");
});
it(i4(), "projects cascade", "Deleting a project leaves nothing behind", "pm1 deletes project one", "0 tasks, milestones, members, messages, attachments, comments", async () => {
    await as(pg, u.pm1, "delete from projects where id = $1", [p.one]);
    for (const table of ["tasks", "milestones", "project_members", "chat_messages", "task_attachments", "task_comments", "activity_feed", "project_invitations"])
        assert.equal((await su(`select 1 from ${table} where project_id = $1`, [p.one])).length, 0, table);
});
it(i4(), "tasks guard", "Regression D-19: a task can't link to another project's phase", "pm1 links a milestone of project two", "Refused", () => refused(u.pm1, "insert into tasks (project_id, title, milestone_id) values ($1, 'x', $2)", [p.one, m.two]));
it(i4(), "tasks guard", "Regression D-19: work can't be assigned to someone outside the project", "pm1 assigns crew2", "Refused", () => refused(u.pm1, "insert into tasks (project_id, title, assigned_to) values ($1, 'x', $2)", [p.one, u.crew2]));
it(i4(), "tasks guard", "A PM may take a task on their own project", "pm1 assigns self", "Saved", async () => assert.equal((await addTask(u.pm1, p.one, { assigned_to: u.pm1 })).rows.length, 1));
it(i4(), "task_attachments guard", "Regression D-19: a file can't be filed against another project's task", "crew1 attaches to project two's task under project one", "Refused", () => refused(u.crew1, `insert into task_attachments (task_id, project_id, storage_path, file_name, mime_type, byte_size, media_kind, uploaded_by) values ($1, $2, 'p', 'n', 'image/png', 1, 'photo', $3)`, [t.two, p.one, u.crew1]));

// ─── IT-05 ──────────────────────────────────────────────────────────────────
const i5 = seq("IT-05");
it(i5(), "tasks + guard", "Crew start their assigned task; it persists", "crew1, to_do to in_progress", "in_progress", async () => {
    await move(u.crew1, t.todo, "in_progress");
    assert.equal(await stage(t.todo), "in_progress");
});
it(i5(), "tasks + guard", "Crew submit with proof", "crew1, in_progress to review, photo attached", "review", async () => {
    await proof(t.doing);
    await move(u.crew1, t.doing, "review");
    assert.equal(await stage(t.doing), "review");
});
it(i5(), "tasks + guard", "Regression D-06: the database requires proof too", "crew1 submits with no photo or video, direct API", "Refused, stays in_progress", async () => {
    await refused(u.crew1, "update tasks set stage = 'review' where id = $1", [t.doing]);
    assert.equal(await stage(t.doing), "in_progress");
});
it(i5(), "tasks + guard", "Regression D-06: crew can't skip a stage", "crew1, to_do to review, direct API", "Refused", () => refused(u.crew1, "update tasks set stage = 'review' where id = $1", [t.todo]));
it(i5(), "tasks + guard", "Regression D-06: crew can't pull work back from review", "crew1, review to in_progress", "Refused", () => refused(u.crew1, "update tasks set stage = 'in_progress' where id = $1", [t.review]));
it(i5(), "tasks + guard", "Crew can't accept their own work", "crew1, review to done", "Refused", () => refused(u.crew1, "update tasks set stage = 'done' where id = $1", [t.review]));
it(i5(), "tasks + guard", "Regression D-06: accepted work is frozen for crew", "crew1 rewrites completed_at on an accepted task", "Refused, timestamp unchanged", async () => {
    const before = (await one("select completed_at from tasks where id = $1", [t.done])).completed_at;
    await refused(u.crew1, "update tasks set completed_at = '2020-01-01' where id = $1", [t.done]);
    assert.deepEqual((await one("select completed_at from tasks where id = $1", [t.done])).completed_at, before);
});
it(i5(), "tasks + guard", "Regression D-06: an accepted task's checklist is frozen for crew", "crew1 edits checklist on a done task", "Refused", () => refused(u.crew1, `update tasks set checklist = '[]' where id = $1`, [t.done]));
for (const [what, set] of [["title", "title = 'x'"], ["due date", "due_date = '2030-01-01'"], ["client visibility", "client_visible_at = now()"], ["priority", "priority = 'high'"]])
    it(i5(), "tasks + guard", "Crew can't edit the plan", `crew1 changes ${what}`, "Refused", () => refused(u.crew1, `update tasks set ${set} where id = $1`, [t.doing]));
it(i5(), "tasks + guard", "Crew can reorder and tick off their own open task", "crew1 sets position and checklist", "Saved", async () => {
    await as(pg, u.crew1, `update tasks set position = 9, checklist = '[{"id":"1","label":"a","done":true}]' where id = $1`, [t.doing]);
    assert.equal((await one("select position from tasks where id = $1", [t.doing])).position, 9);
});
it(i5(), "tasks RLS", "Crew can't touch a colleague's task on another project", "crew2 moves crew1's task", "No row changed", () => refused(u.crew2, "update tasks set stage = 'in_progress' where id = $1", [t.todo]));
it(i5(), "tasks enum", "An invalid status is refused", "stage 'shipped'", "Refused", () => refused(u.pm1, "update tasks set stage = 'shipped' where id = $1", [t.todo]));
it(i5(), "tasks + stamp trigger", "PM acceptance stamps completion once; sending back clears it", "review to done, then back", "completed_at set, then null", async () => {
    await move(u.pm1, t.review, "done");
    assert.ok((await one("select completed_at from tasks where id = $1", [t.review])).completed_at);
    await move(u.pm1, t.review, "in_progress");
    assert.equal((await one("select completed_at from tasks where id = $1", [t.review])).completed_at, null);
});
it(i5(), "tasks + guard", "Regression D-07: acceptance must follow review", "PM moves in_progress straight to done, direct API", "Refused", () => refused(u.pm1, "update tasks set stage = 'done' where id = $1", [t.doing]));
it(i5(), "tasks + guard", "Regression D-07: a task can't be created already accepted", "PM inserts stage done", "Refused", () => refused(u.pm1, "insert into tasks (project_id, title, stage) values ($1, 'x', 'done')", [p.one]));
it(i5(), "tasks concurrency", "A race for open work has one winner", "crew1 claims, then a second claim on the same row", "Second claim changes nothing", async () => {
    const claim = (who) => as(pg, who, "update tasks set assigned_to = $1 where id = $2 and assigned_to is null", [who, t.open]);
    assert.equal((await claim(u.crew1)).count, 1);
    await su("insert into project_members (project_id, user_id) values ($1, $2)", [p.one, u.crew2]);
    assert.equal((await claim(u.crew2)).count, 0);
    assert.equal((await one("select assigned_to from tasks where id = $1", [t.open])).assigned_to, u.crew1);
});
for (const [what, who, sql] of [["task edit as PM", "pm1", `update tasks set title = 'x' where id = '${t.todo}'`], ["crew start", "crew1", `update tasks set stage = 'in_progress' where id = '${t.todo}'`], ["new task as PM", "pm1", `insert into tasks (project_id, title) values ('${p.one}', 'x')`], ["phase edit as PM", "pm1", `update milestones set title = 'x' where id = '${m.one}'`]])
    it(i5(), "closed project guard", "Regression D-08: a closed project is read-only in the database", what, "Refused", async () => {
        await su("update tasks set stage = 'done' where project_id = $1", [p.one]);
        await su("update milestones set completed = true where project_id = $1", [p.one]);
        await su("update projects set status = 'completed' where id = $1", [p.one]);
        if (what === "crew start")
            await su("update tasks set stage = 'to_do' where id = $1", [t.todo]);
        await refused(u[who], sql);
    });

// ─── IT-06 ──────────────────────────────────────────────────────────────────
const i6 = seq("IT-06");
it(i6(), "milestones + RLS", "A PM reschedules; every project participant reads the new date", "pm1 moves due date", "pm1, crew1 and client1 read the same date", async () => {
    await as(pg, u.pm1, "update milestones set due_date = '2026-03-03' where id = $1", [m.one]);
    for (const who of [u.pm1, u.crew1, u.client1])
        assert.equal((await as(pg, who, "select due_date::text d from milestones where id = $1", [m.one])).rows[0].d, "2026-03-03");
});
for (const who of ["pm2", "crew1", "client1"])
    it(i6(), "milestones RLS", "Only this project's PM reschedules", `${who} updates the date`, "No row changed", () => refused(u[who], "update milestones set due_date = '2030-01-01' where id = $1", [m.one]));
it(i6(), "milestones + stamp trigger", "Delivering stamps a date; reopening clears it", "completed true, then false", "completed_at set, then null", async () => {
    await as(pg, u.pm1, "update milestones set completed = true where id = $1", [m.one]);
    assert.ok((await one("select completed_at from milestones where id = $1", [m.one])).completed_at);
    await as(pg, u.pm1, "update milestones set completed = false where id = $1", [m.one]);
    assert.equal((await one("select completed_at from milestones where id = $1", [m.one])).completed_at, null);
});
it(i6(), "schema", "Records that task dependencies aren't implemented: scheduling is by phase order", "tables and columns named like dependency", "None exist", async () => assert.equal((await su(`select 1 from information_schema.columns where table_schema = 'public' and (column_name ilike '%depend%' or table_name ilike '%depend%')`)).length, 0));
blocked(i6(), "Timeline UI across sessions", "Rendered timeline and live date update in a second signed-in session", NEEDS_SUPABASE);

// ─── IT-07 ──────────────────────────────────────────────────────────────────
const i7 = seq("IT-07");
const titles = async (who) => (await as(pg, who, "select title from tasks where project_id = $1 order by title", [p.one])).rows.map((r) => r.title);
it(i7(), "tasks RLS", "Regression D-01: a client reads only accepted work", "client1 selects every task, direct API", "Accepted task only", async () => assert.deepEqual(await titles(u.client1), ["Accepted task"]));
it(i7(), "tasks RLS", "Staff still see the whole board", "crew1 and pm1 select tasks", "5 tasks each", async () => {
    assert.equal((await titles(u.crew1)).length, 5);
    assert.equal((await titles(u.pm1)).length, 5);
});
it(i7(), "accept flow", "Work reaches the client only when accepted, and not before", "crew submits, PM accepts with client_visible_at", "Hidden in review, visible after", async () => {
    assert.ok(!(await titles(u.client1)).includes("Review task"));
    await as(pg, u.pm1, "update tasks set stage = 'done', client_visible_at = now() where id = $1", [t.review]);
    assert.ok((await titles(u.client1)).includes("Review task"));
});
it(i7(), "tasks guard", "Regression D-07: nothing is published before acceptance", "PM sets client_visible_at on an in_progress task", "Refused", () => refused(u.pm1, "update tasks set client_visible_at = now() where id = $1", [t.doing]));
it(i7(), "tasks guard", "Regression D-07: reopening an accepted task withdraws it from the client", "PM moves done back to in_progress", "client_visible_at cleared, client no longer sees it", async () => {
    await move(u.pm1, t.done, "in_progress");
    assert.equal((await one("select client_visible_at from tasks where id = $1", [t.done])).client_visible_at, null);
    assert.ok(!(await titles(u.client1)).includes("Accepted task"));
});
it(i7(), "task_attachments RLS", "Regression D-02: a client can't discover unapproved photos", "client1 selects all attachments", "Approved photo only", async () => assert.deepEqual((await as(pg, u.client1, "select id from task_attachments")).rows.map((r) => r.id), [a.approved]));
it(i7(), "task_attachments RLS", "Crew and PM still see every photo on the project", "crew1 and pm1", "2 attachments each", async () => {
    for (const who of [u.crew1, u.pm1])
        assert.equal((await as(pg, who, "select id from task_attachments")).rows.length, 2);
});
it(i7(), "task_attachments RLS", "Regression D-04: crew can't approve their own photo while uploading", "crew1 inserts with approved_for_client_at", "Refused", () => refused(u.crew1, `insert into task_attachments (task_id, project_id, storage_path, file_name, mime_type, byte_size, media_kind, uploaded_by, approved_for_client_at) values ($1, $2, 'p', 'n', 'image/png', 1, 'photo', $3, now())`, [t.doing, p.one, u.crew1]));
it(i7(), "task_attachments RLS", "Crew can't approve an existing photo", "crew1 updates approved_for_client_at", "No row changed", () => refused(u.crew1, "update task_attachments set approved_for_client_at = now() where id = $1", [a.draft]));
it(i7(), "task_attachments RLS", "Regression D-04: clients don't file site evidence", "client1 inserts a task attachment", "Refused", () => refused(u.client1, `insert into task_attachments (task_id, project_id, storage_path, file_name, mime_type, byte_size, media_kind, uploaded_by) values ($1, $2, 'p', 'n', 'image/png', 1, 'photo', $3)`, [t.done, p.one, u.client1]));
it(i7(), "project_files RLS", "A client reads shared documents only", "client1 selects files", "Shared file only", async () => assert.deepEqual((await as(pg, u.client1, "select id from project_files")).rows.map((r) => r.id), [f.shared]));
it(i7(), "project_files RLS", "Regression D-04: crew can't publish a document while uploading", "crew1 inserts with shared_with_client_at", "Refused", () => refused(u.crew1, `insert into project_files (project_id, folder, storage_path, file_name, mime_type, byte_size, uploaded_by, shared_with_client_at) values ($1, 'drawings', 'p', 'n', 'application/pdf', 1, $2, now())`, [p.one, u.crew1]));
it(i7(), "task_comments RLS", "A client can't read internal task comments", "client1 selects comments", "No rows", async () => assert.equal((await as(pg, u.client1, "select * from task_comments")).rows.length, 0));
it(i7(), "activity_feed RLS", "Regression D-03: a client doesn't see send-back reasons", "client1 reads the log", "No row holds the reason", async () => assert.doesNotMatch(JSON.stringify((await as(pg, u.client1, "select details from activity_feed")).rows), /internal rework reason/));
it(i7(), "activity_feed RLS", "The client still gets the PM's status update and delivered phases", "client1 reads the log", "project_update and milestone_completed present", async () => {
    const types = (await as(pg, u.client1, "select action_type from activity_feed")).rows.map((r) => r.action_type);
    assert.ok(types.includes("project_update") && types.includes("milestone_completed"), types.join());
});
it(i7(), "activity_feed RLS", "Regression D-18: only the PM posts a status update", "client1 inserts a project_update", "Refused", () => refused(u.client1, `insert into activity_feed (project_id, user_id, action_type, details) values ($1, $2, 'project_update', '{"note":"forged"}')`, [p.one, u.client1]));
it(i7(), "activity_feed RLS", "The PM can post a status update", "pm1 inserts a project_update", "Saved", async () => assert.equal((await as(pg, u.pm1, `insert into activity_feed (project_id, user_id, action_type, details) values ($1, $2, 'project_update', '{}') returning id`, [p.one, u.pm1])).rows.length, 1));
it(i7(), "projects guard", "Regression D-08: handover requires everything finished", "PM marks project completed with open tasks, direct API", "Refused, status unchanged", async () => {
    await refused(u.pm1, "update projects set status = 'completed' where id = $1", [p.one]);
    assert.equal((await one("select status from projects where id = $1", [p.one])).status, "in_progress");
});
it(i7(), "projects guard", "A finished project closes and can reopen", "all tasks done, phases delivered", "completed, then in_progress", async () => {
    await su("update tasks set stage = 'done' where project_id = $1", [p.one]);
    await su("update milestones set completed = true where project_id = $1", [p.one]);
    await as(pg, u.pm1, "update projects set status = 'completed', completed_at = now(), completed_by = $1 where id = $2", [u.pm1, p.one]);
    assert.equal((await one("select status from projects where id = $1", [p.one])).status, "completed");
    await as(pg, u.pm1, "update projects set status = 'in_progress', completed_at = null where id = $1", [p.one]);
    assert.equal((await one("select status from projects where id = $1", [p.one])).status, "in_progress");
});

// ─── IT-08 ──────────────────────────────────────────────────────────────────
const i8 = seq("IT-08");
for (const table of ["tasks", "milestones", "projects", "project_members", "chat_messages", "user_notifications", "task_attachments"])
    it(i8(), "supabase_realtime publication", "The table a live view listens to is published", table, "Published", async () => assert.equal((await su("select 1 from pg_publication_tables where pubname = 'supabase_realtime' and tablename = $1", [table])).length, 1));
it(i8(), "tasks replica identity", "Update events carry the previous stage", "tasks", "REPLICA IDENTITY FULL", async () => assert.equal((await one("select relreplident r from pg_class where oid = 'public.tasks'::regclass")).r, "f"));
it(i8(), "RLS as realtime's filter", "A user without access would be sent nothing for this row", "crew2 and client2 evaluate a project one task", "Row not visible", async () => {
    for (const who of [u.crew2, u.client2])
        assert.equal((await as(pg, who, "select 1 from tasks where id = $1", [t.todo])).rows.length, 0);
});
for (const what of ["User A's update delivered to User B with measured latency", "Database matches both clients after delivery", "User C receives nothing (live socket)", "Repeated events don't duplicate tasks in the UI", "Disconnected client catches up"])
    blocked(i8(), "Supabase Realtime", what, NEEDS_SUPABASE);

// ─── IT-09 ──────────────────────────────────────────────────────────────────
const i9 = seq("IT-09");
const send = (who, project, sender, content) => as(pg, who, "insert into chat_messages (project_id, sender_id, content) values ($1, $2, $3) returning id", [project, sender, content]);
for (const who of ["pm1", "crew1", "client1"])
    it(i9(), "chat_messages RLS", "Project participants can send", `${who} sends`, "Saved", async () => assert.equal((await send(u[who], p.one, u[who], "hello")).rows.length, 1));
for (const who of ["pm2", "crew2", "client2"])
    it(i9(), "chat_messages RLS", "Outsiders can't send or read", `${who}, project one`, "Send refused, 0 rows read", async () => {
        await refused(u[who], "insert into chat_messages (project_id, sender_id, content) values ($1, $2, 'x')", [p.one, u[who]]);
        assert.equal((await as(pg, u[who], "select 1 from chat_messages where project_id = $1", [p.one])).rows.length, 0);
    });
it(i9(), "chat_messages RLS", "Nobody sends under another name", "crew1 sets sender_id to the PM", "Refused", () => refused(u.crew1, "insert into chat_messages (project_id, sender_id, content) values ($1, $2, 'x')", [p.one, u.pm1]));
for (const content of ["", "   ", "\n\t"])
    it(i9(), "chat_messages constraint", "Regression D-17: an empty message is refused", JSON.stringify(content), "Refused", () => refused(u.crew1, "insert into chat_messages (project_id, sender_id, content) values ($1, $2, $3)", [p.one, u.crew1, content]));
it(i9(), "chat_messages order", "Messages read back in the order sent", "project one, by created_at", "first, second", async () => assert.deepEqual((await as(pg, u.client1, "select content from chat_messages where project_id = $1 order by created_at", [p.one])).rows.map((r) => r.content), ["first", "second"]));
it(i9(), "chat_messages RLS", "Sent messages can't be rewritten or deleted", "sender updates, then deletes", "No row changed", async () => {
    await refused(u.crew1, "update chat_messages set content = 'x' where sender_id = $1", [u.crew1]);
    await refused(u.crew1, "delete from chat_messages where sender_id = $1", [u.crew1]);
});
it(i9(), "project_members + chat", "A removed member loses the conversation at once", "crew1 removed by PM", "No read, no send", async () => {
    await as(pg, u.pm1, "delete from project_members where project_id = $1 and user_id = $2", [p.one, u.crew1]);
    assert.equal((await as(pg, u.crew1, "select 1 from chat_messages where project_id = $1", [p.one])).rows.length, 0);
    await refused(u.crew1, "insert into chat_messages (project_id, sender_id, content) values ($1, $2, 'x')", [p.one, u.crew1]);
});
it(i9(), "chat_inbox()", "The inbox lists only the viewer's rooms, with correct unread", "client1", "Project one only, unread 2", async () => {
    const { rows } = await as(pg, u.client1, "select project_id, unread from chat_inbox()");
    assert.deepEqual(rows, [{ project_id: p.one, unread: 2 }]);
});
it(i9(), "project_chat_read_cursors", "Reading clears unread, for the reader only", "client1 marks read", "client1 unread 0, PM unaffected", async () => {
    await as(pg, u.client1, "insert into project_chat_read_cursors (project_id, user_id, last_read_at) values ($1, $2, now())", [p.one, u.client1]);
    assert.equal((await as(pg, u.client1, "select unread from chat_inbox()")).rows[0].unread, 0);
    assert.equal((await as(pg, u.pm1, "select unread from chat_inbox() where project_id = $1", [p.one])).rows[0].unread, 1);
});
blocked(i9(), "Supabase Realtime", "Live delivery, duplicates, reconnection, simultaneous sends", NEEDS_SUPABASE);

// ─── IT-10 ──────────────────────────────────────────────────────────────────
const i10 = seq("IT-10");
const put = (who, bucket, name) => as(pg, who, "insert into storage.objects (bucket_id, name, owner) values ($1, $2, $3) returning id", [bucket, name, who]);
it(i10(), "storage.objects RLS", "Crew upload into their own project", "crew1, project-tasks, project one path", "Saved", async () => assert.equal((await put(u.crew1, "project-tasks", `${p.one}/t/a.jpg`)).rows.length, 1));
it(i10(), "storage.objects RLS", "Nobody uploads into a project they aren't on", "crew1, project two path", "Refused", () => refused(u.crew1, "insert into storage.objects (bucket_id, name, owner) values ('project-tasks', $1, $2)", [`${p.two}/t/a.jpg`, u.crew1]));
it(i10(), "storage.objects RLS", "A path without a project id is refused", "not-a-uuid/a.jpg", "Refused", () => refused(u.crew1, "insert into storage.objects (bucket_id, name, owner) values ('project-tasks', 'not-a-uuid/a.jpg', $1)", [u.crew1]));
it(i10(), "storage.objects RLS", "Regression D-04: a client can't write to the site-evidence bucket", "client1 uploads to project-tasks", "Refused", () => refused(u.client1, "insert into storage.objects (bucket_id, name, owner) values ('project-tasks', $1, $2)", [`${p.one}/t/a.jpg`, u.client1]));
it(i10(), "storage.objects RLS", "A client can still attach files in chat", "client1 uploads to project-chat", "Saved", async () => assert.equal((await put(u.client1, "project-chat", `${p.one}/m/a.jpg`)).rows.length, 1));
for (const who of ["client1", "client2", "crew2", "pm2"])
    it(i10(), "storage.objects RLS", "The API won't list another project's objects or a client's", `${who} lists project one's objects`, "No rows", async () => assert.equal((await as(pg, u[who], "select 1 from storage.objects where name like $1", [`${p.one}/%`])).rows.length, 0));
it(i10(), "storage.objects RLS", "Project staff can list their own project's files", "crew1", "1 object", async () => assert.equal((await as(pg, u.crew1, "select 1 from storage.objects where name like $1", [`${p.one}/%`])).rows.length, 1));
it(i10(), "storage.objects RLS", "Files can't be deleted by outsiders", "crew2 deletes project one's object", "No row changed", () => refused(u.crew2, "delete from storage.objects where name like $1", [`${p.one}/%`]));
it(i10(), "storage.buckets", "D-20 (OPEN): private project files aren't readable by link alone", "public flag on both buckets", "Both private", async () => assert.deepEqual((await su("select id, public from storage.buckets where id like 'project-%' order by id")).map((b) => b.public), [false, false]));
it(i10(), "storage.buckets", "D-21 (OPEN): the server restricts file type", "allowed_mime_types on both buckets", "Set on both", async () => assert.ok((await su("select allowed_mime_types a from storage.buckets where id like 'project-%'")).every((b) => b.a)));
for (const what of ["Real upload, object and metadata consistency", "Permitted retrieval and private URL handling", "Oversized and invalid file rejected by the service", "Failed upload recovery against the service"])
    blocked(i10(), "Supabase Storage API", what, NEEDS_SUPABASE);

// ─── IT-11 ──────────────────────────────────────────────────────────────────
const i11 = seq("IT-11");
const PRIVATE = ["projects", "project_members", "milestones", "tasks", "task_attachments", "task_comments", "project_files", "chat_messages", "chat_message_attachments", "activity_feed", "project_invitations", "project_chat_read_cursors", "user_notifications", "inquiries", "inquiry_views", "profiles"];
for (const table of PRIVATE)
    it(i11(), `${table} RLS`, "Anonymous access exposes nothing", `anon selects ${table}`, "No rows", async () => assert.equal((await as(pg, null, `select * from ${table}`)).rows.length, 0));
for (const table of PRIVATE.filter((x) => x !== "inquiries"))
    it(i11(), `${table} RLS`, "Anonymous writes are refused", `anon deletes from ${table}`, "No row changed", () => refused(null, `delete from ${table}`));
const SCOPED = ["project_members", "milestones", "tasks", "task_attachments", "task_comments", "project_files", "chat_messages", "chat_message_attachments", "activity_feed", "project_invitations", "project_chat_read_cursors"];
for (const who of ["client2", "crew2", "pm2"])
    for (const table of SCOPED)
        it(i11(), `${table} RLS`, "No cross-project reads", `${who} reads project one's ${table}`, "No rows", async () => assert.equal((await as(pg, u[who], `select * from ${table} where project_id = $1`, [p.one])).rows.length, 0));
for (const who of ["client2", "crew2", "pm2"])
    it(i11(), "projects RLS", "A project is invisible to outsiders", `${who} selects project one`, "No rows", async () => assert.equal((await as(pg, u[who], "select * from projects where id = $1", [p.one])).rows.length, 0));
for (const who of ["client2", "crew2", "pm2", "client1", "crew1"])
    it(i11(), "projects RLS", "Only the owning PM edits or deletes", `${who} updates and deletes project one`, "No row changed", async () => {
        await refused(u[who], "update projects set title = 'x' where id = $1", [p.one]);
        await refused(u[who], "delete from projects where id = $1", [p.one]);
    });
it(i11(), "tasks RLS", "A PM can't change another PM's work", "pm2 updates and deletes a project one task", "No row changed", async () => {
    await refused(u.pm2, "update tasks set title = 'x' where id = $1", [t.todo]);
    await refused(u.pm2, "delete from tasks where id = $1", [t.todo]);
});
it(i11(), "project_members RLS", "A PM can't add people to another PM's project", "pm2 adds crew2 to project one", "Refused", () => refused(u.pm2, "insert into project_members (project_id, user_id) values ($1, $2)", [p.one, u.crew2]));
for (const who of ["client1", "crew1"])
    it(i11(), "tasks RLS", "Clients and crew can't create tasks", `${who} inserts a task`, "Refused", () => refused(u[who], "insert into tasks (project_id, title) values ($1, 'x')", [p.one]));
it(i11(), "tasks RLS", "A client can't edit anything on the board", "client1 updates an accepted task", "No row changed", () => refused(u.client1, "update tasks set title = 'x' where id = $1", [t.done]));
for (const who of ["client1", "crew1", "pm1"])
    it(i11(), "guard_profile_role", "Nobody promotes themselves", `${who} sets own role to super_admin`, "Refused, role unchanged", async () => {
        const before = (await one("select role from profiles where id = $1", [u[who]])).role;
        await refused(u[who], "update profiles set role = 'super_admin' where id = $1", [u[who]]);
        assert.equal((await one("select role from profiles where id = $1", [u[who]])).role, before);
    });
it(i11(), "guard_profile_classification", "Crew can't change their classification", "crew1 sets foreman", "Refused", () => refused(u.crew1, "update profiles set classification = 'foreman' where id = $1", [u.crew1]));
it(i11(), "profiles RLS", "People can edit their own details", "client1 sets full_name", "Saved", async () => {
    await as(pg, u.client1, "update profiles set full_name = 'Renamed' where id = $1", [u.client1]);
    assert.equal((await one("select full_name from profiles where id = $1", [u.client1])).full_name, "Renamed");
});
it(i11(), "profiles RLS", "A PM can't edit someone else", "pm1 renames client1", "No row changed", () => refused(u.pm1, "update profiles set full_name = 'x' where id = $1", [u.client1]));
it(i11(), "profiles RLS", "The super admin can change a role", "admin promotes client1", "Saved", async () => {
    await as(pg, u.admin, "update profiles set role = 'project_manager' where id = $1", [u.client1]);
    assert.equal((await one("select role from profiles where id = $1", [u.client1])).role, "project_manager");
});
it(i11(), "profiles RLS", "Regression D-16: clients can't read the phone numbers of unrelated people", "client1 selects client2's and crew2's profiles", "No rows", async () => assert.equal((await as(pg, u.client1, "select contact_number from profiles where id in ($1, $2)", [u.client2, u.crew2])).rows.length, 0));
it(i11(), "profiles RLS", "Regression D-16: crew can't browse people outside their projects", "crew1 selects client2", "No rows", async () => assert.equal((await as(pg, u.crew1, "select 1 from profiles where id = $1", [u.client2])).rows.length, 0));
it(i11(), "profiles RLS", "Regression D-16: project teammates can still see each other", "client1 reads pm1 and crew1", "Both rows", async () => assert.equal((await as(pg, u.client1, "select 1 from profiles where id in ($1, $2)", [u.pm1, u.crew1])).rows.length, 2));
it(i11(), "profiles RLS", "Regression D-16: the person who invited you is visible before you accept", "client2 reads a PM with a pending invitation", "1 row", async () => {
    await su(`insert into project_invitations (project_id, invitee_id, invitee_role, status, invited_by, project_title) values ($1, $2, 'client', 'pending', $3, 'x')`, [p.one, u.client2, u.pm1]);
    assert.equal((await as(pg, u.client2, "select 1 from profiles where id = $1", [u.pm1])).rows.length, 1);
});
it(i11(), "profiles RLS", "A PM still sees the directory needed to staff a project", "pm1 selects clients and crew", "All 4", async () => assert.equal((await as(pg, u.pm1, "select 1 from profiles where role in ('client', 'middleman')")).rows.length, 4));
it(i11(), "profiles RLS", "The super admin still sees everyone", "admin selects profiles", "All 7", async () => assert.equal((await as(pg, u.admin, "select 1 from profiles")).rows.length, 7));
const notify = (who, target, href = "/projects", project = p.one, task = t.todo) => as(pg, who, "select create_work_ready_notification($1, $2, $3, 'title', 'body', $4)", [target, task, project, href]);
it(i11(), "create_work_ready_notification", "Regression D-05: anonymous callers can't create notifications", "anon calls the function", "Refused", async () => {
    await assert.rejects(notify(null, u.client2));
});
it(i11(), "create_work_ready_notification", "Regression D-05: a stranger can't message a user through the bell", "client2 notifies crew1 about project one", "Refused, nothing stored", async () => {
    await assert.rejects(notify(u.client2, u.crew1));
    assert.equal((await su("select 1 from user_notifications where user_id = $1", [u.crew1])).length, 0);
});
it(i11(), "create_work_ready_notification", "Regression D-05: a notification can't link off the site", "PM uses https://evil.test as href", "Refused", async () => assert.rejects(notify(u.pm1, u.crew1, "https://evil.test")));
it(i11(), "create_work_ready_notification", "Regression D-05: notifications only go to people on the project", "PM notifies crew2 about project one", "Refused", async () => assert.rejects(notify(u.pm1, u.crew2)));
for (const [fn, sql] of [["create_milestone_delivered_notification", `select create_milestone_delivered_notification('${u.client2}', '${m.two}', '${p.two}', 't', 'b', '/x')`], ["create_project_completed_notification", `select create_project_completed_notification('${u.client2}', '${p.two}', 't', 'b', '/x')`]])
    it(i11(), fn, "Regression D-05: outsiders can't use the other notification functions", `client1 targets project two`, "Refused", async () => assert.rejects(as(pg, u.client1, sql)));
blocked(i11(), "PostgREST and Supabase JWTs", "The same checks through the real API with real tokens, and against any hand-added live policies", NEEDS_SUPABASE);

// ─── IT-12 ──────────────────────────────────────────────────────────────────
const i12 = seq("IT-12");
const bell = async (who) => (await su("select kind, title from user_notifications where user_id = $1", [who])).map((n) => n.kind);
it(i12(), "notify_task_review", "A submission notifies the project's PM, not the crew", "crew1 submits", "pm1 gets task_submitted, crew1 nothing", async () => {
    await proof(t.doing);
    await move(u.crew1, t.doing, "review");
    assert.deepEqual(await bell(u.pm1), ["task_submitted"]);
    assert.deepEqual(await bell(u.crew1), []);
});
for (const [to, kind] of [["done", "task_accepted"], ["in_progress", "task_sent_back"]])
    it(i12(), "notify_task_review", "The review decision reaches the assignee", `PM moves review to ${to}`, `crew1 gets ${kind}`, async () => {
        await move(u.pm1, t.review, to);
        assert.deepEqual(await bell(u.crew1), [kind]);
    });
it(i12(), "notify_task_review", "Nobody is notified of their own action", "PM submits a task of their own project", "pm1 gets nothing", async () => {
    await proof(t.doing);
    await move(u.pm1, t.doing, "review");
    assert.deepEqual(await bell(u.pm1), []);
});
it(i12(), "notify_invitation_change", "An invitation reaches the invitee; the answer reaches the PM", "invite, then accept", "client2 invitation, pm1 invitation_answered", async () => {
    await openProject();
    assert.deepEqual(await bell(u.client2), ["invitation"]);
    await accept(u.client2);
    assert.deepEqual(await bell(u.pm1), ["invitation_answered"]);
});
it(i12(), "create_work_ready_notification", "A repeated event doesn't stack while unread", "same call twice", "1 notification", async () => {
    await notify(u.pm1, u.crew1);
    await notify(u.pm1, u.crew1);
    assert.equal((await bell(u.crew1)).length, 1);
});
it(i12(), "user_notifications RLS", "Read status persists, for the owner only", "crew1 reads theirs; crew2 tries the same row", "read_at set; crew2 changes nothing", async () => {
    await notify(u.pm1, u.crew1);
    const { id } = await one("select id from user_notifications where user_id = $1", [u.crew1]);
    await refused(u.crew2, "update user_notifications set read_at = now() where id = $1", [id]);
    assert.equal((await one("select read_at from user_notifications where id = $1", [id])).read_at, null);
    await as(pg, u.crew1, "update user_notifications set read_at = now() where id = $1", [id]);
    assert.ok((await one("select read_at from user_notifications where id = $1", [id])).read_at);
});
it(i12(), "user_notifications RLS", "Nobody reads another person's bell", "crew2 selects crew1's", "No rows", async () => {
    await notify(u.pm1, u.crew1);
    assert.equal((await as(pg, u.crew2, "select 1 from user_notifications where user_id = $1", [u.crew1])).rows.length, 0);
});
blocked(i12(), "Supabase Realtime", "Live bell update, delayed and failed delivery", NEEDS_SUPABASE);

// ─── IT-13 ──────────────────────────────────────────────────────────────────
const i13 = seq("IT-13");
it(i13(), "project_members + tasks", "A member removed mid-session can't keep working", "PM removes crew1, crew1 then moves a task", "No row changed", async () => {
    await as(pg, u.pm1, "delete from project_members where project_id = $1 and user_id = $2", [p.one, u.crew1]);
    await refused(u.crew1, "update tasks set stage = 'in_progress' where id = $1", [t.todo]);
});
it(i13(), "transactions", "A failed write leaves no partial data", "valid insert then failing insert in one statement batch, rolled back", "No new rows", async () => {
    await pg.exec("savepoint s");
    await su("insert into tasks (project_id, title) values ($1, 'partial')", [p.one]);
    await assert.rejects(su("insert into tasks (project_id, title) values ($1, null)", [p.one]));
    await pg.exec("rollback to savepoint s");
    assert.equal((await su("select 1 from tasks where title = 'partial'")).length, 0);
});
it(i13(), "tasks concurrency", "A stale second writer on the same row is last-write-wins (records current behaviour)", "PM renames, crew then ticks the checklist", "Both changes persist, since they touch different columns", async () => {
    await as(pg, u.pm1, "update tasks set title = 'Renamed' where id = $1", [t.doing]);
    await as(pg, u.crew1, `update tasks set checklist = '[{"id":"1","label":"a","done":true}]' where id = $1`, [t.doing]);
    const row = await one("select title, checklist from tasks where id = $1", [t.doing]);
    assert.equal(row.title, "Renamed");
    assert.equal(row.checklist.length, 1);
});
it(i13(), "as anon after expiry", "A request with no valid session is treated as anonymous", "no sub claim", "No data", async () => assert.equal((await as(pg, null, "select 1 from tasks")).rows.length, 0));
for (const what of ["Token expiry and refresh against Auth", "Realtime channel drop and recovery", "Storage outage during upload"])
    blocked(i13(), "Supabase services", what, NEEDS_SUPABASE);

// ─── IT-14 ──────────────────────────────────────────────────────────────────
it("IT-14.01", "Whole lifecycle across roles", "Project to handover at the database layer, each step as its role", "PM creates, both accept, tasks run to acceptance, PM closes", "Each step persisted; client sees only accepted work; project completed", async () => {
    await openProject(u.pm1, u.client2, u.crew2);
    await accept(u.client2);
    await accept(u.crew2, true);
    assert.equal(await status(), "planning");
    const m3 = (await as(pg, u.pm1, `insert into milestones (project_id, title, due_date) values ($1, 'Handover', '2026-02-01') returning id`, [P3])).rows[0].id;
    const t3 = (await as(pg, u.pm1, `insert into tasks (project_id, milestone_id, title, stage, assigned_to) values ($1, $2, 'Install', 'to_do', $3) returning id`, [P3, m3, u.crew2])).rows[0].id;
    await as(pg, u.pm1, "update projects set status = 'in_progress' where id = $1", [P3]);
    await move(u.crew2, t3, "in_progress");
    await as(pg, u.crew2, `insert into task_attachments (task_id, project_id, storage_path, file_name, mime_type, byte_size, media_kind, uploaded_by) values ($1, $2, 'a/b/c.jpg', 'c.jpg', 'image/jpeg', 1, 'photo', $3)`, [t3, P3, u.crew2]);
    await move(u.crew2, t3, "review");
    assert.equal((await as(pg, u.client2, "select 1 from tasks where id = $1", [t3])).rows.length, 0, "not visible while in review");
    await as(pg, u.pm1, "update tasks set stage = 'done', client_visible_at = now() where id = $1", [t3]);
    await as(pg, u.pm1, "update task_attachments set approved_for_client_at = now() where task_id = $1", [t3]);
    await as(pg, u.pm1, "update milestones set completed = true where id = $1", [m3]);
    assert.equal((await as(pg, u.client2, "select 1 from tasks where id = $1", [t3])).rows.length, 1, "visible after acceptance");
    assert.equal((await as(pg, u.client2, "select 1 from task_attachments where task_id = $1", [t3])).rows.length, 1, "approved photo visible");
    await send(u.client2, P3, u.client2, "Thank you");
    await as(pg, u.pm1, "update projects set status = 'completed', completed_at = now(), completed_by = $1 where id = $2", [u.pm1, P3]);
    assert.equal(await status(), "completed");
});
