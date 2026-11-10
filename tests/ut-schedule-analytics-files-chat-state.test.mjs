// UT-09 Schedule, UT-10 Analytics, UT-11 Files, UT-12 Messaging, UT-13 UI state.
import assert from "node:assert/strict";
import { kase } from "./helpers/harness.mjs";

const { fakeSupabase } = await import("./helpers/stubs.mjs");
const sch = await import("@/lib/schedule");
const dash = await import("@/lib/dashboard");
const an = await import("@/lib/analytics");
const media = await import("@/lib/media-kind");
const { uploadTaskAttachment, indexAttachmentsByTask } = await import("@/services/task-attachment-service");
const { uploadChatAttachment } = await import("@/services/chat-attachment-service");
const { sendChatMessage } = await import("@/services/chat-service");
const msg = await import("@/lib/messenger");
const { findNewlyReadyAssignedTasks } = await import("@/lib/work-ready-notifications");
const { useMessenger, askAbout } = await import("@/components/messenger/messenger-store");

const seq = (prefix) => {
    let n = 0;
    return () => `${prefix}.${String(++n).padStart(2, "0")}`;
};

// ─── UT-09 ──────────────────────────────────────────────────────────────────
const id9 = seq("UT-09");
const M1 = { id: "a", due_date: "2026-02-01" }, M2 = { id: "b", due_date: "2026-03-01" };
kase(id9(), "milestoneSpans", "Each bar runs from the previous due date", "project start 2026-01-01, two out-of-order phases", "Jan 1 to Feb 1, then Feb 1 to Mar 1", () => assert.deepEqual(sch.milestoneSpans([M2, M1], "2026-01-01"), [{ id: "a", start: "2026-01-01", end: "2026-02-01" }, { id: "b", start: "2026-02-01", end: "2026-03-01" }]));
kase(id9(), "milestoneSpans", "A phase due before the project starts has no negative bar", "due 2025-12-01, start 2026-01-01", "start equals end", () => {
    const [s] = sch.milestoneSpans([{ id: "a", due_date: "2025-12-01" }], "2026-01-01");
    assert.equal(s.start, s.end);
});
kase(id9(), "milestoneSpans", "Two phases due the same day overlap harmlessly", "same due date", "Second bar has zero length", () => {
    const s = sch.milestoneSpans([M1, { id: "c", due_date: M1.due_date }], "2026-01-01");
    assert.equal(s[1].start, s[1].end);
});
for (const [what, id, today, typed, want] of [["future phase opens after the previous", "b", "2026-01-15", undefined, { start_date: "2026-02-02", due_date: "2026-03-01" }], ["phase already open starts today", "b", "2026-02-10", undefined, { start_date: "2026-02-10", due_date: "2026-03-01" }], ["typed due date wins", "a", "2026-01-10", "2026-01-20", { start_date: "2026-01-10", due_date: "2026-01-20" }], ["start never passes the due date", "a", "2026-06-01", undefined, { start_date: "2026-02-01", due_date: "2026-02-01" }], ["unknown phase", "zz", "2026-01-01", undefined, null]])
    kase(id9(), "milestoneTaskDates", "A task's default dates", what, JSON.stringify(want), () => assert.deepEqual(sch.milestoneTaskDates(id, [M1, M2], "2026-01-01", today, typed), want));
const R = { from: "2026-01-01", to: "2026-01-11" };
kase(id9(), "timelineRange", "The window covers a phase outside the project, padded 3 days", "phase due after the end", "Jan 29 to Apr 4", () => assert.deepEqual(sch.timelineRange("2026-02-01", "2026-03-01", [{ due_date: "2026-04-01" }]), { from: "2026-01-29", to: "2026-04-04" }));
for (const [date, f] of [["2026-01-01", 0], ["2026-01-06", 0.5], ["2026-01-11", 1]])
    kase(id9(), "dateToFraction", "Where a date sits on the bar", date, String(f), () => assert.equal(sch.dateToFraction(date, R), f));
for (const [f, date] of [[-0.5, "2026-01-01"], [0.53, "2026-01-06"], [1.5, "2026-01-11"]])
    kase(id9(), "fractionToDate", "A drag snaps to a whole day inside the window", String(f), date, () => assert.equal(sch.fractionToDate(f, R), date));
kase(id9(), "dateToFraction", "A zero-length window doesn't divide by zero", "from equals to", "0", () => assert.equal(sch.dateToFraction("2026-01-01", { from: "2026-01-01", to: "2026-01-01" }), 0));
kase(id9(), "fractionToDate", "Date to position and back is exact for every day", "each of 11 days", "Same date back", () => {
    for (let i = 0; i <= 10; i++) {
        const d = dash.addDays(R.from, i);
        assert.equal(sch.fractionToDate(sch.dateToFraction(d, R), R), d);
    }
});
for (const [a, b, want] of [["2026-01-01", "2026-01-03", "+2d"], ["2026-01-03", "2026-01-01", "−2d"], ["2026-01-01", "2026-01-01", ""]])
    kase(id9(), "shiftLabel", "How far a reschedule moved", `${a} to ${b}`, want || "(blank)", () => assert.equal(sch.shiftLabel(a, b), want));
kase(id9(), "monthTicks", "Month lines cross a year boundary", "2025-11-15 to 2026-02-15", "2025-12-01, 2026-01-01, 2026-02-01", () => assert.deepEqual(sch.monthTicks({ from: "2025-11-15", to: "2026-02-15" }).map((t) => t.date), ["2025-12-01", "2026-01-01", "2026-02-01"]));
for (const [iso, want] of [["2026-01-31T15:59:59Z", "2026-01-31"], ["2026-01-31T16:00:00Z", "2026-02-01"]])
    kase(id9(), "isoDateIn", "Dates are Manila calendar dates at the midnight boundary", iso, want, () => assert.equal(dash.isoDateIn(iso), want));
for (const [from, n, want] of [["2024-02-28", 1, "2024-02-29"], ["2025-02-28", 1, "2025-03-01"], ["2026-12-31", 1, "2027-01-01"], ["2026-03-08", 1, "2026-03-09"]])
    kase(id9(), "addDays", "Calendar arithmetic across leap days, years and a US clock change", `${from} + ${n}`, want, () => assert.equal(dash.addDays(from, n), want));
kase(id9(), "daysBetween", "A negative span stays negative", "later to earlier", "-3", () => assert.equal(dash.daysBetween("2026-01-04", "2026-01-01"), -3));

// ─── UT-10 ──────────────────────────────────────────────────────────────────
const id10 = seq("UT-10");
const TODAY = "2026-06-15";
const P = (o = {}) => ({ id: "p", title: "P", pm_id: "pm", client_id: "c", status: "in_progress", start_date: "2026-01-01", end_date: "2026-12-31", completed_at: null, ...o });
const T = (stage, due_date = null, o = {}) => ({ id: Math.random().toString(), project_id: "p", title: "T", stage, assigned_to: null, due_date, completed_at: null, updated_at: `${TODAY}T00:00:00Z`, ...o });
const Mi = (completed, due_date, o = {}) => ({ id: Math.random().toString(), project_id: "p", title: "M", due_date, completed, completed_at: completed ? `${due_date}T02:00:00Z` : null, ...o });

kase(id10(), "taskBreakdown", "An empty project is all zeros", "no tasks", "All 0", () => assert.deepEqual(an.taskBreakdown([], TODAY), { completed: 0, ongoing: 0, upcoming: 0, overdue: 0, total: 0 }));
kase(id10(), "taskBreakdown", "Only accepted work counts as completed", "one each of to_do, in_progress, review, done", "completed 1, total 4", () => {
    const b = an.taskBreakdown([T("to_do"), T("in_progress"), T("review"), T("done")], TODAY);
    assert.equal(b.completed, 1);
    assert.equal(b.total, 4);
});
kase(id10(), "taskBreakdown", "Every task lands in exactly one stage bucket; overdue is an overlay on open work", "mixed set with 2 late open tasks", "completed + ongoing + upcoming = total, overdue 2", () => {
    const b = an.taskBreakdown([T("to_do", "2026-01-01"), T("in_progress", "2026-01-01"), T("in_progress"), T("review", "2099-01-01"), T("done", "2026-01-01")], TODAY);
    assert.equal(b.completed + b.ongoing + b.upcoming, b.total);
    assert.equal(b.overdue, 2);
});
kase(id10(), "taskBreakdown", "Accepted work is never overdue", "done with a past due date", "overdue 0", () => assert.equal(an.taskBreakdown([T("done", "2026-01-01")], TODAY).overdue, 0));
kase(id10(), "taskBreakdown", "Due today isn't overdue", "due today", "overdue 0", () => assert.equal(an.taskBreakdown([T("in_progress", TODAY)], TODAY).overdue, 0));
kase(id10(), "openLoad", "Open work counts exclude accepted tasks", "review, late to_do, done", "open 2, late 1, review 1", () => assert.deepEqual(an.openLoad([T("review"), T("to_do", "2026-01-01"), T("done", "2026-01-01")], TODAY), { open: 2, late: 1, review: 1 }));
kase(id10(), "milestoneRecord", "Delivered on time, delivered late and overdue are separate", "on-time, late, overdue, future", "completed 2, onTime 1, overdue 1", () => {
    const r = an.milestoneRecord([Mi(true, "2026-02-01"), Mi(true, "2026-03-01", { completed_at: "2026-03-05T02:00:00Z" }), Mi(false, "2026-04-01"), Mi(false, "2026-09-01")], TODAY);
    assert.deepEqual([r.completed, r.onTime, r.overdue], [2, 1, 1]);
});
kase(id10(), "milestoneRecord", "No milestones", "empty", "All 0", () => assert.deepEqual(an.milestoneRecord([], TODAY), { completed: 0, onTime: 0, overdue: 0, ticks: [] }));
kase(id10(), "deliveryRecord", "No delivered projects", "empty", "delivered 0, avgLate null", () => assert.deepEqual(an.deliveryRecord([]), { delivered: 0, onTime: 0, avgLate: null }));
kase(id10(), "deliveries", "Only closed projects count as delivered", "active and completed", "1 delivery", () => assert.equal(an.deliveries([P(), P({ id: "q", status: "completed", end_date: "2026-05-01", completed_at: "2026-05-03T02:00:00Z" })]).length, 1));
kase(id10(), "peopleCount", "User totals by role", "4 roles, 2 clients", "Counted per role", () => {
    const c = an.peopleCount(["client", "client", "middleman", "project_manager", "super_admin"]);
    assert.ok(Object.values(c).reduce((a, b) => a + b, 0) >= 4, JSON.stringify(c));
});
kase(id10(), "managingCount", "Closed projects don't count as being managed", "one active, one completed, different PMs", "1", () => assert.equal(an.managingCount([P(), P({ pm_id: "other", status: "completed" })]), 1));
kase(id10(), "projectLoads", "Progress counts only accepted tasks; other projects stay out", "3 tasks in p, 1 elsewhere", "total 3, done 1", () => {
    const l = dash.projectLoads(["p"], [{ ...T("done"), project_id: "p" }, { ...T("review"), project_id: "p" }, { ...T("to_do"), project_id: "p" }, { ...T("done"), project_id: "other" }], [], TODAY).get("p");
    assert.equal(l.tasksTotal, 3);
    assert.equal(l.stages.done, 1);
});
kase(id10(), "toMoves", "Malformed log rows are ignored", "rows missing task_id or stages", "Only the valid row", () => assert.equal(an.toMoves([{ details: {}, created_at: "x" }, { details: null, created_at: "x" }, { details: { task_id: "t", from: "review", to: "done" }, created_at: "2026-01-01" }]).length, 1));
kase(id10(), "overrun", "A project on schedule has no overrun", "end far off, no late phase", "null", () => assert.equal(an.overrun(P(), [], TODAY), null));

// ─── UT-11 ──────────────────────────────────────────────────────────────────
const id11 = seq("UT-11");
const MB = 1024 * 1024;
for (const [mime, kind] of [["image/jpeg", "photo"], ["image/heic", "photo"], ["video/mp4", "video"], ["application/pdf", "file"], ["", "file"], ["text/html", "file"]])
    kase(id11(), "mediaKindFromMime", "How a file is classified", mime || "(blank)", kind, () => assert.equal(media.mediaKindFromMime(mime), kind));
for (const [size, ok] of [[50 * MB, true], [50 * MB + 1, false], [0, true]])
    kase(id11(), "uploadTooBig", "The 50 MB limit at its boundary", `${size} bytes`, ok ? "null" : "Message", () => assert.equal(media.uploadTooBig({ size, type: "image/png" }) === null, ok));
for (const [what, list, want] of [["none", [], false], ["file only", [{ media_kind: "file" }], false], ["photo", [{ media_kind: "photo" }], true], ["video", [{ media_kind: "video" }], true]])
    kase(id11(), "hasSiteEvidence", "What counts as proof", what, String(want), () => assert.equal(media.hasSiteEvidence(list), want));

const file = (name, type = "image/jpeg", size = 10) => ({ name, type, size });
const uploadDb = (over = {}) => fakeSupabase((q) => {
    if (q.op === "upload")
        return { error: over.uploadFails ? new Error("storage down") : null };
    if (q.table === "task_attachments" && over.rowFails)
        return { data: null, error: new Error("row refused") };
    if (q.table === "task_attachments" || q.table === "chat_message_attachments")
        return { data: { id: "a" }, error: null };
    if (q.table === "chat_messages" && q.op === "insert")
        return { data: { id: "m" }, error: null };
    return null;
}, { userId: over.anon ? undefined : "me" });

kase(id11(), "uploadTaskAttachment", "An oversized file is refused before any network call", "51 MB", "Throws, no query", async () => {
    const sb = uploadDb();
    await assert.rejects(uploadTaskAttachment("p", "t", file("a.jpg", "image/jpeg", 51 * MB), sb), /up to 50 MB/);
    assert.equal(sb.calls.length, 0);
});
kase(id11(), "uploadTaskAttachment", "Signed-out uploads are refused", "no session", "Throws, no upload", async () => {
    const sb = uploadDb({ anon: true });
    await assert.rejects(uploadTaskAttachment("p", "t", file("a.jpg"), sb), /Not authenticated/);
    assert.equal(sb.calls.filter((c) => c.op === "upload").length, 0);
});
for (const name of ["../../../etc/passwd", "..\\..\\evil.exe", "a/b/c.jpg", "my photo (1).jpg", "ファイル.jpg", "x".repeat(300) + ".jpg", "<img src=x onerror=1>.jpg"])
    kase(id11(), "uploadTaskAttachment", "A filename can't escape its folder", name.slice(0, 40), "Exactly p/t/<uuid>-<safe name>, no slash or backslash in the name", async () => {
        const sb = uploadDb();
        await uploadTaskAttachment("p", "t", file(name), sb);
        const path = sb.calls.find((c) => c.op === "upload").payload;
        const parts = path.split("/");
        assert.equal(parts.length, 3, path);
        assert.deepEqual(parts.slice(0, 2), ["p", "t"]);
        assert.doesNotMatch(parts[2], /\\|<|>/);
        assert.ok(parts[2].length <= 36 + 1 + 120);
    });
kase(id11(), "uploadTaskAttachment", "A missing MIME type is treated as a plain file", "type blank", "application/octet-stream, kind file", async () => {
    const sb = uploadDb();
    await uploadTaskAttachment("p", "t", file("a.bin", ""), sb);
    const row = sb.calls.find((c) => c.table === "task_attachments").payload;
    assert.deepEqual([row.mime_type, row.media_kind], ["application/octet-stream", "file"]);
});
kase(id11(), "uploadTaskAttachment", "Storage failure leaves no database row", "upload errors", "Throws, no row", async () => {
    const sb = uploadDb({ uploadFails: true });
    await assert.rejects(uploadTaskAttachment("p", "t", file("a.jpg"), sb), /storage down/);
    assert.equal(sb.calls.filter((c) => c.table === "task_attachments").length, 0);
});
kase(id11(), "uploadTaskAttachment", "Regression D-14: a refused row doesn't strand the uploaded file", "upload ok, row insert fails", "Throws, stored object removed", async () => {
    const sb = uploadDb({ rowFails: true });
    await assert.rejects(uploadTaskAttachment("p", "t", file("a.jpg"), sb), /row refused/);
    const path = sb.calls.find((c) => c.op === "upload").payload;
    assert.deepEqual(sb.calls.find((c) => c.op === "remove")?.payload, [path]);
});
kase(id11(), "uploadChatAttachment", "A failed chat upload takes its message with it", "upload errors", "Message deleted", async () => {
    const sb = uploadDb({ uploadFails: true });
    await assert.rejects(uploadChatAttachment("p", file("a.jpg"), { client: sb }), /storage down/);
    assert.ok(sb.calls.some((c) => c.table === "chat_messages" && c.op === "delete"));
});
kase(id11(), "indexAttachmentsByTask", "Files stay with their task", "2 tasks, 3 files", "Grouped by task", () => {
    const m = indexAttachmentsByTask([{ task_id: "a" }, { task_id: "b" }, { task_id: "a" }]);
    assert.deepEqual([m.get("a").length, m.get("b").length], [2, 1]);
});

// ─── UT-12 ──────────────────────────────────────────────────────────────────
const id12 = seq("UT-12");
kase(id12(), "sendChatMessage", "Signed-out sends are refused", "no session", "Throws, no insert", async () => {
    const sb = fakeSupabase();
    await assert.rejects(sendChatMessage("p", "hi", sb), /Not authenticated/);
    assert.equal(sb.calls.length, 0);
});
kase(id12(), "sendChatMessage", "The sender comes from the session, not the caller", "session user me", "sender_id me, content trimmed", async () => {
    const sb = fakeSupabase(() => ({ data: { id: "m" }, error: null }), { userId: "me" });
    await sendChatMessage("p", "  hi  ", sb);
    assert.deepEqual([sb.calls[0].payload.sender_id, sb.calls[0].payload.content], ["me", "hi"]);
});
for (const [what, row, want] of [["no messages", undefined, "No messages yet"], ["own message", { last_content: "thanks", last_sender_id: "me" }, "You: thanks"], ["someone else, first name only", { last_content: "tiles", last_sender_id: "x", last_sender_name: "Josh Reyes" }, "Josh: tiles"], ["unknown sender", { last_content: "hi", last_sender_id: "x", last_sender_name: null }, "Someone: hi"]])
    kase(id12(), "previewLine", "The inbox preview", what, want, () => assert.equal(msg.previewLine(row, "me"), want));
const project = (id, title, status = "in_progress") => ({ id, title, status, people: [] });
kase(id12(), "buildInbox", "Newest conversation first, silent by title, closed apart", "4 projects", "b, a, c active; d closed", () => {
    const r = msg.buildInbox([project("a", "A"), project("b", "B"), project("c", "C"), project("d", "D", "completed")], [{ project_id: "a", last_message_at: "2026-01-01T00:00:00Z", unread: 1 }, { project_id: "b", last_message_at: "2026-01-02T00:00:00Z", unread: 2 }], "me");
    assert.deepEqual(r.active.map((i) => i.id), ["b", "a", "c"]);
    assert.deepEqual(r.closed.map((i) => i.id), ["d"]);
    assert.equal(msg.totalUnread(r.active), 3);
});
kase(id12(), "unreadByProject", "Unread counts stay per project", "a:1, b:0", "{a:1,b:0}", () => assert.deepEqual(msg.unreadByProject([{ id: "a", unread: 1 }, { id: "b", unread: 0 }]), { a: 1, b: 0 }));
const NOW = new Date("2026-06-15T12:00:00Z");
for (const [iso, want] of [["2026-06-15T11:59:30Z", "now"], ["2026-06-15T11:15:00Z", "45m"], ["2026-06-15T07:00:00Z", "5h"], ["2026-06-13T12:00:00Z", "2d"], ["2026-05-01T12:00:00Z", "May 1"]])
    kase(id12(), "inboxTime", "Message age wording", iso, want, () => assert.equal(msg.inboxTime(iso, NOW), want));
kase(id12(), "resolveActive", "A project just joined isn't mistaken for a forbidden one", "missing, load not settled", "No fall-back", () => assert.equal(msg.resolveActive([], "x", false).fallBack, false));
kase(id12(), "resolveActive", "A project the viewer lost access to falls back to the list", "missing, load settled", "Fall-back", () => assert.equal(msg.resolveActive([], "x", true).fallBack, true));
const snap = (id, assigned_to, stage, milestone_id = null) => ({ id, assigned_to, stage, milestone_id, title: id, project_id: "p" });
kase(id12(), "findNewlyReadyAssignedTasks", "A new assignment notifies once, for the assignee", "task newly assigned", "1 candidate, reason assigned", () => {
    const r = findNewlyReadyAssignedTasks([snap("t", null, "to_do")], [snap("t", "u", "to_do")], []);
    assert.deepEqual(r.map((c) => [c.userId, c.reason]), [["u", "assigned"]]);
});
kase(id12(), "findNewlyReadyAssignedTasks", "Nothing changed, nothing sent", "identical snapshots", "No candidates", () => assert.equal(findNewlyReadyAssignedTasks([snap("t", "u", "to_do")], [snap("t", "u", "to_do")], []).length, 0));
kase(id12(), "findNewlyReadyAssignedTasks", "Accepted work never notifies", "assigned while done", "No candidates", () => assert.equal(findNewlyReadyAssignedTasks([snap("t", null, "done")], [snap("t", "u", "done")], []).length, 0));

// ─── UT-13 ──────────────────────────────────────────────────────────────────
const id13 = seq("UT-13");
const INITIAL = useMessenger.getState();
const fresh = () => useMessenger.setState(INITIAL, true);
const state = () => useMessenger.getState();
kase(id13(), "useMessenger", "Starts closed and empty", "new store", "open false, no project, no drafts, unread null", () => {
    fresh();
    assert.deepEqual([state().open, state().activeProjectId, state().drafts, state().unread, state().inbox], [false, null, {}, null, null]);
});
kase(id13(), "openChat", "Opens on the given project", "openChat(a)", "open, active a, openedAt set", () => {
    fresh();
    state().openChat("a");
    assert.deepEqual([state().open, state().activeProjectId, state().openedAt > 0], [true, "a", true]);
});
kase(id13(), "openChat", "With no project, resumes where the viewer left off", "openChat(a), minimize, openChat()", "active a", () => {
    fresh();
    state().openChat("a");
    state().minimize();
    state().openChat();
    assert.equal(state().activeProjectId, "a");
});
kase(id13(), "minimize", "Keeps the conversation", "minimize", "closed, active kept", () => {
    fresh();
    state().openChat("a");
    state().minimize();
    assert.deepEqual([state().open, state().activeProjectId], [false, "a"]);
});
kase(id13(), "back", "Shows the list", "back", "active null", () => {
    fresh();
    state().openChat("a");
    state().back();
    assert.equal(state().activeProjectId, null);
});
kase(id13(), "setDraft", "Switching projects never mixes drafts", "drafts on a and b", "Each keeps its own", () => {
    fresh();
    state().setDraft("a", "for a");
    state().setDraft("b", "for b");
    state().openChat("b");
    assert.deepEqual(state().drafts, { a: "for a", b: "for b" });
});
kase(id13(), "askAbout", "Opens the project's chat with the question started", "askAbout(a, Tiles)", "active a, draft mentions Tiles", () => {
    fresh();
    askAbout("a", "Tiles");
    assert.equal(state().activeProjectId, "a");
    assert.match(state().drafts.a, /Tiles/);
});
kase(id13(), "setUnread", "Unread can reset to not loaded", "set then null", "null", () => {
    fresh();
    state().setUnread({ a: 1 });
    state().setUnread(null);
    assert.equal(state().unread, null);
});
kase(id13(), "signOut", "One account's state can't reach the next: sign-out does a full page load", "source of account-menu.tsx", "window.location.replace, not client-side navigation", async () => {
    const { readFileSync } = await import("node:fs");
    assert.match(readFileSync("components/shell/account-menu.tsx", "utf8"), /window\.location\.replace\(ROUTES\.LOGIN\)/);
});
