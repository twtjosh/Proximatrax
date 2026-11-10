// UT-11 continued: the route that decides who may open a stored file.
import assert from "node:assert/strict";
import { kase } from "./helpers/harness.mjs";

const { fakeSupabase, setFake } = await import("./helpers/stubs.mjs");
const { fileUrl } = await import("@/lib/media-kind");
const { publicTaskAttachmentUrl } = await import("@/services/task-attachment-service");
const { publicAttachmentUrl } = await import("@/services/chat-attachment-service");
const { GET } = await import("@/app/api/files/[bucket]/[...path]/route");

process.env.NEXT_PUBLIC_SUPABASE_URL = "http://127.0.0.1:1";
process.env.SUPABASE_SERVICE_ROLE_KEY = "stub";

const ORIGIN = "https://app.test";
const PATH = "p/t/uuid-my photo (1).jpg";
let n = 0;
const id = () => `UT-11.F${String(++n).padStart(2, "0")}`;

/** `visible` lists the tables whose row the viewer can read. */
function setup({ userId = "me", visible = [], signError = false } = {}) {
    const user = fakeSupabase((q) => (visible.includes(q.table) ? { data: { id: "row" }, error: null } : { data: null, error: null }), { userId });
    const admin = fakeSupabase();
    admin.signed = [];
    admin.storage.from = (bucket) => ({
        createSignedUrl: async (path, seconds, options) => {
            admin.signed.push({ bucket, path, seconds, options });
            return signError ? { data: null, error: new Error("missing") } : { data: { signedUrl: "https://storage.test/signed" }, error: null };
        },
    });
    setFake(user, admin);
    return { user, admin };
}
const get = (path) => GET(new Request(`${ORIGIN}${path}`));
const url = fileUrl("project-tasks", PATH);

kase(id(), "fileUrl", "Filenames with spaces and parentheses stay one path", PATH, "Same-origin path, slashes kept", () => assert.equal(url, "/api/files/project-tasks/p/t/uuid-my%20photo%20(1).jpg"));
kase(id(), "publicTaskAttachmentUrl", "Regression D-20: no direct storage link is handed out", "task file", "Goes through the app route", () => assert.match(publicTaskAttachmentUrl("a/b.jpg"), /^\/api\/files\/project-tasks\//));
kase(id(), "publicAttachmentUrl", "Regression D-20: no direct storage link for chat files", "chat file", "Goes through the app route", () => assert.match(publicAttachmentUrl("a/b.jpg"), /^\/api\/files\/project-chat\//));
kase(id(), "GET /api/files", "A signed-out request is refused", "no session", "401, nothing signed", async () => {
    const { admin } = setup({ userId: null });
    assert.equal((await get(url)).status, 401);
    assert.equal(admin.signed.length, 0);
});
kase(id(), "GET /api/files", "A file whose row the viewer can't read is hidden", "row not visible", "404, nothing signed", async () => {
    const { admin } = setup();
    assert.equal((await get(url)).status, 404);
    assert.equal(admin.signed.length, 0);
});
for (const [what, path] of [["unknown bucket", "/api/files/secrets/a.jpg"], ["inherited object key", "/api/files/__proto__/a.jpg"], ["no file path", "/api/files/project-tasks"], ["malformed encoding", "/api/files/project-tasks/%E0%A4%A"]])
    kase(id(), "GET /api/files", "Bad addresses are refused", what, "404, nothing signed", async () => {
        const { admin } = setup({ visible: ["task_attachments"] });
        assert.equal((await get(path)).status, 404);
        assert.equal(admin.signed.length, 0);
    });
for (const [table, bucket] of [["task_attachments", "project-tasks"], ["project_files", "project-tasks"], ["chat_message_attachments", "project-chat"]])
    kase(id(), "GET /api/files", "A visible file gets a short-lived link", `row in ${table}`, "302, signed for 300 s, decoded path", async () => {
        const { admin } = setup({ visible: [table] });
        const res = await get(fileUrl(bucket, PATH));
        assert.equal(res.status, 302);
        assert.equal(res.headers.get("location"), "https://storage.test/signed");
        assert.deepEqual(admin.signed[0], { bucket, path: PATH, seconds: 300, options: undefined });
    });
kase(id(), "GET /api/files", "The row is read as the viewer, so RLS decides", "visible row", "Lookup on the viewer's client, by exact path", async () => {
    const { user, admin } = setup({ visible: ["task_attachments"] });
    await get(url);
    assert.ok(user.calls.some((c) => c.table === "task_attachments" && c.filters.some(([f, col, v]) => f === "eq" && col === "storage_path" && v === PATH)));
    assert.equal(admin.calls.length, 0);
});
kase(id(), "GET /api/files", "A chat lookup never consults task records", "project-chat file", "Only chat_message_attachments read", async () => {
    const { user } = setup({ visible: ["task_attachments"] });
    assert.equal((await get(fileUrl("project-chat", PATH))).status, 404);
    assert.deepEqual([...new Set(user.calls.map((c) => c.table))], ["chat_message_attachments"]);
});
kase(id(), "GET /api/files", "Download links keep the original filename", "?download=Plan A.pdf", "Signed with that download name", async () => {
    const { admin } = setup({ visible: ["project_files"] });
    await get(`${url}?download=${encodeURIComponent("Plan A.pdf")}`);
    assert.deepEqual(admin.signed[0].options, { download: "Plan A.pdf" });
});
kase(id(), "GET /api/files", "A row with no stored object is a clean not-found", "signing fails", "404", async () => {
    setup({ visible: ["task_attachments"], signError: true });
    assert.equal((await get(url)).status, 404);
});
kase(id(), "GET /api/files", "A cached redirect can't outlive its link", "visible file", "max-age 120, private", async () => {
    setup({ visible: ["task_attachments"] });
    assert.equal((await get(url)).headers.get("cache-control"), "private, max-age=120");
});
