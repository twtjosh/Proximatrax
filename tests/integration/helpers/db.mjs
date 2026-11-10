// An isolated, in-process PostgreSQL (PGlite) with the app's real migrations.
// Nothing here can reach a Supabase project: there is no URL and no key.
//
// Supabase's auth and storage schemas are stubbed to the shape the migrations
// need, and the default grants are reproduced (anon and authenticated may touch
// every public table), so row-level security is the only thing in the way, as
// on Supabase. Ordinary users are simulated with `SET LOCAL ROLE`, never as the
// superuser that seeds fixtures.
//
// Limits: this proves the migration files, not the live database (policies
// added by hand in the dashboard are invisible here), and it has no PostgREST,
// GoTrue, Realtime or Storage API.
import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { PGlite } from "@electric-sql/pglite";
import { pgcrypto } from "@electric-sql/pglite/contrib/pgcrypto";

const MIGRATIONS = join(import.meta.dirname, "../../../internal/migrations");

const PREAMBLE = `
create role anon nologin;
create role authenticated nologin;
create role service_role nologin bypassrls;
create schema auth;
grant usage on schema auth to anon, authenticated, service_role;
create table auth.users (
  id uuid primary key default gen_random_uuid(),
  email text unique,
  raw_user_meta_data jsonb not null default '{}',
  raw_app_meta_data jsonb not null default '{}'
);
create function auth.uid() returns uuid language sql stable as
  $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
create function auth.role() returns text language sql stable as
  $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), 'anon') $$;
create function auth.jwt() returns jsonb language sql stable as
  $$ select jsonb_build_object('sub', auth.uid(), 'role', auth.role()) $$;

create schema storage;
grant usage on schema storage to anon, authenticated, service_role;
create table storage.buckets (
  id text primary key, name text not null, public boolean default false,
  file_size_limit bigint, allowed_mime_types text[]
);
create table storage.objects (
  id uuid primary key default gen_random_uuid(),
  bucket_id text references storage.buckets(id), name text, owner uuid,
  metadata jsonb, created_at timestamptz default now()
);
alter table storage.objects enable row level security;
alter table storage.buckets enable row level security;
grant all on storage.objects, storage.buckets to anon, authenticated, service_role;
create function storage.foldername(name text) returns text[] language sql immutable as
  $$ select (string_to_array(name, '/'))[1 : array_length(string_to_array(name, '/'), 1) - 1] $$;
create function storage.filename(name text) returns text language sql immutable as
  $$ select (string_to_array(name, '/'))[array_length(string_to_array(name, '/'), 1)] $$;

create publication supabase_realtime;
grant usage on schema public to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
alter default privileges in schema public grant execute on functions to anon, authenticated, service_role;
`;

/** Migration files in order; MIGRATIONS_UPTO=0029 replays the database as it stood before a fix. */
export function migrationFiles() {
    const upto = process.env.MIGRATIONS_UPTO ?? "9999";
    return readdirSync(MIGRATIONS).filter((f) => /^\d{4}_.*\.sql$/.test(f) && f.slice(0, 4) <= upto).sort();
}

export async function freshDb() {
    const pg = new PGlite({ extensions: { pgcrypto } });
    await pg.exec(PREAMBLE);
    for (const file of migrationFiles()) {
        try {
            await pg.exec(readFileSync(join(MIGRATIONS, file), "utf8"));
        }
        catch (e) {
            throw new Error(`${file}: ${e.message}`);
        }
    }
    return pg;
}

/**
 * Runs one statement as a signed-in user (or `null` for anon), the way
 * PostgREST does. Inside a savepoint, so a refused statement leaves the
 * surrounding test transaction usable.
 */
export async function as(pg, userId, sql, params = []) {
    await pg.exec("savepoint step");
    try {
        await pg.query(`select set_config('request.jwt.claim.sub', $1, true), set_config('request.jwt.claim.role', $2, true)`, [userId ?? "", userId ? "authenticated" : "anon"]);
        await pg.exec(`set local role ${userId ? "authenticated" : "anon"}`);
        const r = await pg.query(sql, params);
        await pg.exec(`reset role; select set_config('request.jwt.claim.sub', '', true); release savepoint step`);
        return { rows: r.rows, count: r.affectedRows ?? 0 };
    }
    catch (e) {
        await pg.exec("rollback to savepoint step; release savepoint step; reset role");
        throw e;
    }
}

/** The user can't do it: the statement is refused, or it silently touches no row (what RLS does to UPDATE and DELETE). */
export async function denied(pg, userId, sql, params = []) {
    try {
        const r = await as(pg, userId, sql, params);
        return r.count === 0 && r.rows.length === 0;
    }
    catch {
        return true;
    }
}

/** Runs a test body and undoes everything it wrote, so tests can't affect each other. */
export async function isolated(pg, body) {
    await pg.exec("begin");
    try {
        await body();
    }
    finally {
        await pg.exec("rollback");
    }
}

const uuid = (n) => `00000000-0000-4000-8000-${String(n).padStart(12, "0")}`;

/**
 * Two unrelated projects with separate PMs, crew and clients. Seeded as the
 * superuser, so fixtures don't depend on the rules under test.
 */
export async function seed(pg) {
    const u = { admin: uuid(1), pm1: uuid(2), pm2: uuid(3), crew1: uuid(4), crew2: uuid(5), client1: uuid(6), client2: uuid(7) };
    const role = { admin: "super_admin", pm1: "project_manager", pm2: "project_manager", crew1: "middleman", crew2: "middleman", client1: "client", client2: "client" };
    for (const [k, id] of Object.entries(u)) {
        await pg.query(`insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values ($1, $2, $3, $4)`, [id, `${k}@test.invalid`, { role: role[k] }, { full_name: `Test ${k}` }]);
    }
    const p = { one: uuid(101), two: uuid(102) };
    await pg.exec(`
      insert into projects (id, title, status, client_id, pm_id, start_date, end_date) values
        ('${p.one}', 'Project One', 'in_progress', '${u.client1}', '${u.pm1}', '2026-01-01', '2026-06-30'),
        ('${p.two}', 'Project Two', 'in_progress', '${u.client2}', '${u.pm2}', '2026-01-01', '2026-06-30');
      insert into project_members (project_id, user_id, role_in_project) values
        ('${p.one}', '${u.crew1}', 'middleman'),
        ('${p.two}', '${u.crew2}', 'middleman');
    `);
    const m = { one: uuid(201), oneNext: uuid(202), two: uuid(203) };
    await pg.exec(`
      insert into milestones (id, project_id, title, due_date) values
        ('${m.one}', '${p.one}', 'Site Survey', '2026-02-01'),
        ('${m.oneNext}', '${p.one}', 'Handover', '2026-06-30'),
        ('${m.two}', '${p.two}', 'Site Survey', '2026-02-01');
    `);
    const t = { todo: uuid(301), doing: uuid(302), review: uuid(303), done: uuid(304), open: uuid(305), two: uuid(306) };
    await pg.exec(`
      insert into tasks (id, project_id, milestone_id, title, stage, assigned_to, client_visible_at) values
        ('${t.todo}',   '${p.one}', '${m.one}', 'Todo task',     'to_do',       '${u.crew1}', null),
        ('${t.doing}',  '${p.one}', '${m.one}', 'Doing task',    'in_progress', '${u.crew1}', null),
        ('${t.review}', '${p.one}', '${m.one}', 'Review task',   'review',      '${u.crew1}', null),
        ('${t.done}',   '${p.one}', '${m.one}', 'Accepted task', 'done',        '${u.crew1}', now()),
        ('${t.open}',   '${p.one}', '${m.one}', 'Open task',     'to_do',       null,         null),
        ('${t.two}',    '${p.two}', '${m.two}', 'Other project', 'in_progress', '${u.crew2}', null);
    `);
    const a = { draft: uuid(401), approved: uuid(402), two: uuid(403) }, f = { internal: uuid(501), shared: uuid(502) };
    await pg.exec(`
      insert into project_invitations (project_id, invitee_id, invitee_role, status, invited_by, project_title) values
        ('${p.one}', '${u.client1}', 'client',    'accepted', '${u.pm1}', 'Project One'),
        ('${p.one}', '${u.crew1}',   'middleman', 'accepted', '${u.pm1}', 'Project One'),
        ('${p.two}', '${u.client2}', 'client',    'accepted', '${u.pm2}', 'Project Two'),
        ('${p.two}', '${u.crew2}',   'middleman', 'accepted', '${u.pm2}', 'Project Two');
      update profiles set contact_number = '+63900000' || right(id::text, 4);
      insert into task_attachments (id, task_id, project_id, storage_path, file_name, mime_type, byte_size, media_kind, uploaded_by, approved_for_client_at) values
        ('${a.draft}',    '${t.review}', '${p.one}', '${p.one}/${t.review}/draft.jpg', 'draft.jpg', 'image/jpeg', 10, 'photo', '${u.crew1}', null),
        ('${a.approved}', '${t.done}',   '${p.one}', '${p.one}/${t.done}/ok.jpg',      'ok.jpg',    'image/jpeg', 10, 'photo', '${u.crew1}', now()),
        ('${a.two}',      '${t.two}',    '${p.two}', '${p.two}/${t.two}/two.jpg',      'two.jpg',   'image/jpeg', 10, 'photo', '${u.crew2}', null);
      insert into project_files (id, project_id, folder, storage_path, file_name, mime_type, byte_size, uploaded_by, shared_with_client_at) values
        ('${f.internal}', '${p.one}', 'drawings', '${p.one}/d/i.pdf', 'i.pdf', 'application/pdf', 10, '${u.pm1}', null),
        ('${f.shared}',   '${p.one}', 'drawings', '${p.one}/d/s.pdf', 's.pdf', 'application/pdf', 10, '${u.pm1}', now());
      insert into chat_messages (project_id, sender_id, content, created_at) values
        ('${p.one}', '${u.crew1}', 'first',  '2026-01-01T00:00:00Z'),
        ('${p.one}', '${u.pm1}',   'second', '2026-01-01T00:00:01Z'),
        ('${p.two}', '${u.crew2}', 'private to two', '2026-01-01T00:00:00Z');
      insert into task_comments (task_id, project_id, author_id, body) values ('${t.review}', '${p.one}', '${u.pm1}', 'internal note');
      insert into activity_feed (project_id, user_id, action_type, details) values
        ('${p.one}', '${u.pm1}', 'task_moved', '{"task_id":"${t.review}","from":"review","to":"in_progress","reason":"internal rework reason"}'),
        ('${p.one}', '${u.pm1}', 'project_update', '{"status":"on_track","note":"public to client"}'),
        ('${p.one}', '${u.pm1}', 'milestone_completed', '{"title":"Site Survey"}'),
        ('${p.two}', '${u.pm2}', 'project_update', '{"note":"private to two"}');
      insert into inquiries (name, email, message) values ('Visitor', 'visitor@test.invalid', 'Hello');
      insert into storage.buckets (id, name, public) values ('probe', 'probe', false) on conflict do nothing;
      insert into storage.objects (bucket_id, name, owner) values
        ('project-tasks', '${p.one}/${t.review}/draft.jpg', '${u.crew1}'),
        ('project-tasks', '${p.two}/${t.two}/two.jpg', '${u.crew2}');
    `);
    await pg.exec("delete from user_notifications");
    return { u, p, m, t, a, f };
}
