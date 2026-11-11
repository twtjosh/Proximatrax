// The demo path through the real screens, each role in its own browser session.
import { expect, test } from "@playwright/test";
import { randomUUID } from "node:crypto";
import { createClient } from "@supabase/supabase-js";
import { email, staging } from "./env.mjs";

const URL_ = staging.NEXT_PUBLIC_SUPABASE_URL;
const sb = (key) => createClient(URL_, key, { auth: { persistSession: false, autoRefreshToken: false } });
const admin = sb(staging.SUPABASE_SERVICE_ROLE_KEY);
const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==", "base64");
const RUN = randomUUID().slice(0, 8);
const TITLE = `Demo path ${RUN}`, TASK = `Install cabinets ${RUN}`;
const state = {};

async function api(who) {
    const c = sb(staging.NEXT_PUBLIC_SUPABASE_ANON_KEY);
    const { data, error } = await c.auth.signInWithPassword({ email: email(who), password: staging.TEST_PASSWORD });
    if (error)
        throw error;
    c.userId = data.user.id;
    return c;
}
async function signIn(browser, who, options = {}) {
    const context = await browser.newContext({ baseURL: "http://localhost:3200", viewport: { width: 1366, height: 850 }, ...options });
    const page = await context.newPage();
    page.errors = [];
    page.on("pageerror", (e) => page.errors.push(e.message));
    const host = new URL(URL_).host;
    page.on("requestfailed", (r) => r.url().includes(host) && console.log(`[net] ${who} FAILED ${r.method()} ${new URL(r.url()).pathname} ${r.failure()?.errorText}`));
    page.on("response", (r) => r.url().includes(host) && r.status() >= 400 && console.log(`[net] ${who} ${r.status()} ${r.request().method()} ${new URL(r.url()).pathname}`));
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email address").fill(email(who));
    await page.getByLabel("Password", { exact: true }).fill(staging.TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    return page;
}
const row = async (table, column, value, columns = "*") => {
    const { data, error } = await admin.from(table).select(columns).eq(column, value);
    if (error)
        throw error;
    return data;
};
const noCrash = async (page, path) => {
    const res = await page.goto(path);
    await page.waitForLoadState("networkidle");
    expect(res.status(), path).toBeLessThan(500);
    await expect(page.getByText(/something went wrong|application error/i)).toHaveCount(0);
    expect(page.errors, path).toEqual([]);
};

test.describe.configure({ mode: "serial" });
test.beforeAll(async () => {
    for (const bucket of ["project-tasks", "project-chat"]) {
        const { error } = await admin.storage.updateBucket(bucket, { public: false });
        if (error)
            throw error;
    }
});
test.afterAll(async () => {
    if (state.project)
        await admin.from("projects").delete().eq("id", state.project);
});

for (const [who, home] of [["admin", "/dashboard"], ["pm", "/dashboard"], ["crew1", "/middleman"], ["client1", "/dashboard"]])
    test(`ST-02.S | ${who} | Signs in through the form and lands on their home | ${home}`, async ({ browser }) => {
        const page = await signIn(browser, who);
        await expect(page).toHaveURL(new RegExp(`${home}$`));
        await page.waitForLoadState("networkidle");
        expect(page.errors).toEqual([]);
        await page.reload();
        await expect(page, "session survives a refresh").toHaveURL(new RegExp(`${home}$`));
        await page.context().close();
    });
test("ST-02.S | anyone | A wrong password shows an error and stays on sign-in | Alert visible", async ({ page }) => {
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email address").fill(email("pm"));
    await page.getByLabel("Password", { exact: true }).fill("definitely-wrong");
    await page.getByRole("button", { name: "Sign In" }).click();
    await expect(page.getByRole("alert").filter({ hasText: /invalid/i })).toBeVisible();
    await expect(page).toHaveURL(/\/login/);
});
for (const [who, path, to] of [["crew1", "/dashboard", "/middleman"], ["client1", "/settings", "/dashboard"], ["pm", "/inquiries", "/dashboard"], ["admin", "/middleman", "/dashboard"]])
    test(`ST-02.S | ${who} | A page outside this role sends them home | ${path} redirects to ${to}`, async ({ browser }) => {
        const page = await signIn(browser, who);
        await page.goto(path);
        await expect(page).toHaveURL(new RegExp(`${to}$`));
        await page.context().close();
    });
test("ST-03.S | super admin | Dashboard, People and Inquiries open | No crash; the 6 accounts are listed", async ({ browser }) => {
    const page = await signIn(browser, "admin");
    await noCrash(page, "/dashboard");
    await noCrash(page, "/inquiries");
    await noCrash(page, "/settings");
    await expect(page.getByText("Test Client 2").first()).toBeVisible();
    await page.context().close();
});

test("ST-04.S | project manager | Creates a project in the form and invites a team | Project pending, 5 phases, 2 invitations", async ({ browser }) => {
    const page = await signIn(browser, "pm");
    await page.goto("/projects/new");
    await page.waitForLoadState("networkidle");
    await page.locator("#title").fill(TITLE);
    await page.locator("#client").click();
    await page.getByRole("option", { name: /Test Client 1/ }).click();
    await page.locator("#middleman").click();
    await page.getByRole("option", { name: /Test Crew 1/ }).click();
    await page.locator("#start-date").fill("2026-11-01");
    await page.locator("#end-date").fill("2027-03-31");
    await page.getByRole("button", { name: /Create project/ }).click();
    await page.waitForURL(/\/projects\/[0-9a-f-]{36}/, { timeout: 30_000 });
    state.project = /\/projects\/([0-9a-f-]{36})/.exec(page.url())[1];
    expect((await row("projects", "id", state.project))[0].status).toBe("pending_invites");
    expect((await row("milestones", "project_id", state.project)).length).toBe(5);
    expect((await row("project_invitations", "project_id", state.project)).length).toBe(2);
    expect(page.errors).toEqual([]);
    await page.context().close();
});
for (const [who, home] of [["client1", "/dashboard"], ["crew1", "/middleman"]])
    test(`ST-04.S | ${who} | Accepts the invitation on screen | Invitation accepted`, async ({ browser }) => {
        const page = await signIn(browser, who);
        await page.goto(home);
        await page.waitForLoadState("networkidle");
        await page.getByRole("button", { name: /^Accept/ }).first().click();
        await expect.poll(async () => (await row("project_invitations", "project_id", state.project)).find((i) => i.invitee_role === (who === "crew1" ? "middleman" : "client")).status).toBe("accepted");
        expect(page.errors).toEqual([]);
        await page.context().close();
    });
test("ST-04.S | system | Both acceptances activate the project | status planning, crew is a member", async () => {
    expect((await row("projects", "id", state.project))[0].status).toBe("planning");
    expect((await row("project_members", "project_id", state.project)).length).toBe(1);
});
test("ST-04.S | project manager | Task appears on the board and timeline | Board and Timeline show it", async ({ browser }) => {
    const pm = await api("pm");
    const phases = (await row("milestones", "project_id", state.project)).sort((a, b) => a.due_date.localeCompare(b.due_date));
    state.phase = phases[0].id;
    const crew = (await row("project_members", "project_id", state.project))[0].user_id;
    const { data, error } = await pm.from("tasks").insert({ project_id: state.project, milestone_id: state.phase, title: TASK, stage: "to_do", assigned_to: crew, due_date: "2026-12-01" }).select("id").single();
    expect(error).toBeNull();
    state.task = data.id;
    const page = await signIn(browser, "pm");
    await noCrash(page, `/projects/${state.project}/board`);
    await expect(page.locator('[data-rfd-droppable-id="to_do"]').getByText(TASK)).toBeVisible();
    await noCrash(page, `/projects/${state.project}/timeline`);
    await expect(page.getByText("Site Survey").first()).toBeVisible();
    for (const tab of ["", "/files", "/team", "/review"])
        await noCrash(page, `/projects/${state.project}${tab}`);
    await page.context().close();
});
test("ST-05.S | crew | Starts the task from their project page | Stage in_progress", async ({ browser }) => {
    const page = await signIn(browser, "crew1");
    await noCrash(page, `/projects/${state.project}`);
    await page.getByRole("button", { name: "Start work" }).click();
    await expect.poll(async () => (await row("tasks", "id", state.task))[0].stage).toBe("in_progress");
    expect(page.errors).toEqual([]);
    await page.context().close();
});
test("ST-05.S | crew | Without a photo the screen asks for one instead of submitting | Add a photo offered, stage unchanged", async ({ browser }) => {
    const page = await signIn(browser, "crew1");
    await page.goto(`/projects/${state.project}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByRole("button", { name: "Add a photo" })).toBeVisible();
    expect((await row("tasks", "id", state.task))[0].stage).toBe("in_progress");
    await page.context().close();
});
test("ST-09.S | crew and PM | The PM's board updates live when crew submit | Card reaches In review with no reload", async ({ browser }) => {
    const crew = await api("crew1");
    const path = `${state.project}/${state.task}/${randomUUID()}-site.png`;
    expect((await crew.storage.from("project-tasks").upload(path, png, { contentType: "image/png" })).error).toBeNull();
    // 0033: crew can't file a photo directly; the evidence route writes it as the service role.
    expect((await crew.from("task_attachments").insert({ task_id: state.task, project_id: state.project, storage_path: path, file_name: "site.png", mime_type: "image/png", byte_size: png.length, media_kind: "photo", uploaded_by: crew.userId })).error).not.toBeNull();
    expect((await admin.from("task_attachments").insert({ task_id: state.task, project_id: state.project, storage_path: path, file_name: "site.png", mime_type: "image/png", byte_size: png.length, media_kind: "photo", uploaded_by: crew.userId, verified_capture: true })).error).toBeNull();
    state.path = path;
    const pm = await signIn(browser, "pm");
    await pm.goto(`/projects/${state.project}/board`);
    await pm.waitForLoadState("networkidle");
    await expect(pm.locator('[data-rfd-droppable-id="in_progress"]').getByText(TASK)).toBeVisible();
    const page = await signIn(browser, "crew1");
    await page.goto(`/projects/${state.project}`);
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: "Submit for review" }).click();
    await expect.poll(async () => (await row("tasks", "id", state.task))[0].stage).toBe("review");
    await expect(pm.locator('[data-rfd-droppable-id="review"]').getByText(TASK)).toBeVisible({ timeout: 20_000 });
    await page.context().close();
    await pm.context().close();
});
test("ST-06.S | client | Work in review stays hidden, and progress isn't overstated | Updates omit the task, card reads 0%", async ({ browser }) => {
    const page = await signIn(browser, "client1");
    await noCrash(page, `/projects/${state.project}/board`);
    await expect(page.getByText(TASK)).toHaveCount(0);
    await noCrash(page, "/projects");
    await expect(page.getByRole("link", { name: new RegExp(TITLE) }).getByText("0%")).toBeVisible();
    await page.context().close();
});
test("ST-09.S | PM and client | Acceptance reaches the client live, with the photo | Update appears with no reload; phase delivered", async ({ browser }) => {
    const client = await signIn(browser, "client1");
    await client.goto(`/projects/${state.project}/board`);
    await client.waitForLoadState("networkidle");
    const pm = await signIn(browser, "pm");
    await pm.goto(`/projects/${state.project}/review?task=${state.task}`);
    await pm.waitForLoadState("networkidle");
    await pm.getByRole("button", { name: /^Accept/ }).first().click();
    await expect.poll(async () => (await row("tasks", "id", state.task))[0].stage, { timeout: 20_000 }).toBe("done");
    const [task] = await row("tasks", "id", state.task);
    expect(task.client_visible_at).toBeTruthy();
    expect((await row("task_attachments", "task_id", state.task))[0].approved_for_client_at).toBeTruthy();
    await expect(client.getByText(TASK).first()).toBeVisible({ timeout: 20_000 });
    await expect.poll(async () => (await row("milestones", "id", state.phase))[0].completed).toBe(true);
    expect(pm.errors).toEqual([]);
    expect(client.errors).toEqual([]);
    await pm.context().close();
    await client.context().close();
});
test("ST-06.S | client | Figures and photos after acceptance | Card reads 20% (1 of 5 phases), approved photo shown", async ({ browser }) => {
    const page = await signIn(browser, "client1");
    await noCrash(page, "/projects");
    await expect(page.getByRole("link", { name: new RegExp(TITLE) }).getByText("20%")).toBeVisible();
    await noCrash(page, `/projects/${state.project}/photos`);
    await expect(page.locator(`img[src*="${state.path.split("/").at(-1)}"]`).first()).toBeAttached();
    await noCrash(page, `/projects/${state.project}`);
    await noCrash(page, "/dashboard");
    await page.context().close();
});
const route = (bucket, path) => `/api/files/${bucket}/${path.split("/").map(encodeURIComponent).join("/")}`;
const statusOf = async (page, url) => (await page.request.get(url, { maxRedirects: 0 })).status();
test("ST-10.S | system | Prepares files of every kind on the private buckets | Unapproved photo, video, internal and shared documents, chat file", async () => {
    const [pm, crew, client] = await Promise.all([api("pm"), api("crew1"), api("client1")]);
    const { data: task2, error: taskError } = await pm.from("tasks").insert({ project_id: state.project, title: `Second ${RUN}`, stage: "to_do", assigned_to: crew.userId }).select("id").single();
    expect(taskError).toBeNull();
    const put = async (who, bucket, path, type, body = png) => expect((await who.storage.from(bucket).upload(path, body, { contentType: type })).error).toBeNull();
    state.draft = `${state.project}/${task2.id}/${randomUUID()}-draft photo (1).png`;
    await put(crew, "project-tasks", state.draft, "image/png");
    expect((await admin.from("task_attachments").insert({ task_id: task2.id, project_id: state.project, storage_path: state.draft, file_name: "draft photo (1).png", mime_type: "image/png", byte_size: png.length, media_kind: "photo", uploaded_by: crew.userId })).error).toBeNull();
    state.video = `${state.project}/${task2.id}/${randomUUID()}-clip.mp4`;
    await put(crew, "project-tasks", state.video, "video/mp4", Buffer.alloc(4096, 7));
    expect((await admin.from("task_attachments").insert({ task_id: task2.id, project_id: state.project, storage_path: state.video, file_name: "clip.mp4", mime_type: "video/mp4", byte_size: 4096, media_kind: "video", uploaded_by: crew.userId })).error).toBeNull();
    state.internal = `${state.project}/files/${randomUUID()}-internal.pdf`;
    state.shared = `${state.project}/files/${randomUUID()}-shared plan.pdf`;
    await put(pm, "project-tasks", state.internal, "application/pdf");
    await put(pm, "project-tasks", state.shared, "application/pdf");
    expect((await pm.from("project_files").insert([{ project_id: state.project, folder: "drawings", storage_path: state.internal, file_name: "internal.pdf", mime_type: "application/pdf", byte_size: png.length, uploaded_by: pm.userId }, { project_id: state.project, folder: "drawings", storage_path: state.shared, file_name: "shared plan.pdf", mime_type: "application/pdf", byte_size: png.length, uploaded_by: pm.userId, shared_with_client_at: new Date().toISOString() }])).error).toBeNull();
    const { data: message, error: messageError } = await client.from("chat_messages").insert({ project_id: state.project, sender_id: client.userId, content: "a file" }).select("id").single();
    expect(messageError).toBeNull();
    state.chat = `${state.project}/${message.id}/${randomUUID()}-note.png`;
    await put(client, "project-chat", state.chat, "image/png");
    expect((await client.from("chat_message_attachments").insert({ message_id: message.id, project_id: state.project, storage_path: state.chat, file_name: "note.png", mime_type: "image/png", byte_size: png.length, media_kind: "photo", uploaded_by: client.userId })).error).toBeNull();
    state.urls = { approved: route("project-tasks", state.path), draft: route("project-tasks", state.draft), video: route("project-tasks", state.video), internal: route("project-tasks", state.internal), shared: route("project-tasks", state.shared), chat: route("project-chat", state.chat) };
});
test("ST-10.S | anonymous | Nobody opens a private file without signing in | Old public link refused; app route 401", async ({ request }) => {
    for (const [bucket, path] of [["project-tasks", state.path], ["project-tasks", state.shared], ["project-chat", state.chat]])
        expect((await fetch(`${URL_}/storage/v1/object/public/${bucket}/${path}`)).status, path).not.toBe(200);
    for (const url of Object.values(state.urls))
        expect((await request.get(url, { maxRedirects: 0 })).status(), url).toBe(401);
});
for (const [who, want] of [["pm", { approved: 302, draft: 302, video: 302, internal: 302, shared: 302, chat: 302 }], ["crew1", { approved: 302, draft: 302, video: 302, internal: 302, shared: 302, chat: 302 }], ["client1", { approved: 302, draft: 404, video: 404, internal: 404, shared: 302, chat: 302 }], ["client2", { approved: 404, draft: 404, video: 404, internal: 404, shared: 404, chat: 404 }], ["crew2", { approved: 404, draft: 404, video: 404, internal: 404, shared: 404, chat: 404 }]])
    test(`ST-10.S | ${who} | Each file opens only for people allowed to see it | ${JSON.stringify(want).replace(/"/g, "")}`, async ({ browser }) => {
        const page = await signIn(browser, who);
        const got = {};
        for (const [name, url] of Object.entries(state.urls))
            got[name] = await statusOf(page, url);
        expect(got).toEqual(want);
        await page.context().close();
    });
test("ST-10.S | client | An allowed file really downloads, with its name | Image bytes returned; download keeps the filename", async ({ browser }) => {
    const page = await signIn(browser, "client1");
    const image = await page.request.get(state.urls.approved);
    expect(image.status()).toBe(200);
    expect(image.headers()["content-type"]).toContain("image/png");
    expect((await image.body()).equals(png)).toBe(true);
    const file = await page.request.get(`${state.urls.shared}?download=${encodeURIComponent("shared plan.pdf")}`);
    expect(file.status()).toBe(200);
    expect(file.headers()["content-disposition"]).toContain("shared%20plan.pdf");
    await page.context().close();
});
test("ST-10.S | crew | Video can seek after the redirect | Range request returns 206", async ({ browser }) => {
    const page = await signIn(browser, "crew1");
    const res = await page.request.get(state.urls.video, { headers: { range: "bytes=0-99" } });
    expect(res.status()).toBe(206);
    expect((await res.body()).length).toBe(100);
    await page.context().close();
});
for (const [who, path] of [["client1", "photos"], ["pm", "files"], ["crew1", "photos"]])
    test(`ST-10.S | ${who} | Photos display on the real page | /${path}: an image from /api/files has loaded`, async ({ browser }) => {
        const page = await signIn(browser, who);
        await noCrash(page, `/projects/${state.project}/${path}`);
        if (path === "files")
            await page.getByRole("button", { name: /Site photos/ }).click();
        const images = page.locator('img[src^="/api/files/"]');
        await expect(images.first()).toBeAttached();
        await images.first().scrollIntoViewIfNeeded();
        await expect.poll(() => images.first().evaluate((img) => img.complete && img.naturalWidth > 0)).toBe(true);
        await page.context().close();
    });
test("ST-06.S | another client | An unrelated client can't open the project | Not found or redirected, title absent", async ({ browser }) => {
    const page = await signIn(browser, "client2");
    await page.goto(`/projects/${state.project}`);
    await page.waitForLoadState("networkidle");
    await expect(page.getByText(TITLE)).toHaveCount(0);
    await page.context().close();
});
test("ST-13.S | crew | Works at phone width | No sideways scroll on Today or the project at 390px", async ({ browser }) => {
    const page = await signIn(browser, "crew1", { viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    for (const path of ["/middleman", `/projects/${state.project}`]) {
        await noCrash(page, path);
        expect(await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth), path).toBeLessThanOrEqual(0);
    }
    await page.context().close();
});
test("ST-02.S | project manager | Signing out ends the session | Back to sign-in; private page redirects", async ({ browser }) => {
    const page = await signIn(browser, "pm");
    await page.waitForLoadState("networkidle");
    await page.getByRole("button", { name: /Account menu/ }).first().click();
    await page.getByRole("menuitem", { name: /Sign out|Log out/i }).click();
    await page.waitForURL("**/login**");
    await page.goto("/projects");
    await page.waitForURL("**/login**");
    await page.context().close();
});
