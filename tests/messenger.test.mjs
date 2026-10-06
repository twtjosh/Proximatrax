import { test } from "node:test";
import assert from "node:assert/strict";
import { buildInbox, inboxTime, previewLine, resolveActive, totalUnread, unreadByProject } from "../lib/messenger.ts";

const ME = "me";
const project = (id, over = {}) => ({ id, title: over.title ?? id, status: over.status ?? "in_progress", people: [] });
const row = (project_id, over = {}) => ({
    project_id,
    last_message_at: over.at ?? null,
    last_sender_id: over.sender ?? null,
    last_sender_name: over.name ?? null,
    last_content: over.content ?? null,
    unread: over.unread ?? 0,
});

test("previewLine names the sender by first name, or You", () => {
    assert.equal(previewLine(row("p", { sender: "u1", name: "Josh Reyes", content: "tiles are in" }), ME), "Josh: tiles are in");
    assert.equal(previewLine(row("p", { sender: ME, name: "Maria Santos", content: "thanks" }), ME), "You: thanks");
    assert.equal(previewLine(row("p", { sender: "u1", name: null, content: "hi" }), ME), "Someone: hi");
    assert.equal(previewLine(undefined, ME), "No messages yet");
    assert.equal(previewLine(row("p"), ME), "No messages yet");
});

test("buildInbox sorts by latest message, then title, and splits closed projects", () => {
    const { active, closed } = buildInbox(
        [project("a", { title: "Zeta" }), project("b", { title: "Alpha" }), project("c"), project("d", { status: "completed" })],
        [
            row("c", { at: "2026-10-06T09:00:00.000000+00:00", content: "older", sender: "u1", name: "Ana" }),
            row("a", { at: "2026-10-06T10:00:00.000Z", content: "newer", sender: "u1", name: "Ana", unread: 2 }),
            row("d", { at: "2026-10-07T00:00:00Z", content: "done", sender: ME }),
            row("x-not-mine", { at: "2026-10-08T00:00:00Z", content: "ignored", unread: 5 }),
        ],
        ME,
    );
    assert.deepEqual(active.map((i) => i.id), ["a", "c", "b"]);
    assert.equal(active[0].unread, 2);
    assert.equal(active[2].preview, "No messages yet");
    assert.equal(active[2].lastAt, null);
    assert.deepEqual(closed.map((i) => i.id), ["d"]);
});

test("totalUnread sums every row", () => {
    const { active, closed } = buildInbox([project("a"), project("b", { status: "completed" })], [row("a", { unread: 3 }), row("b", { unread: 1 })], ME);
    assert.equal(totalUnread([...active, ...closed]), 4);
});

test("inboxTime is compact and relative", () => {
    const now = new Date("2026-10-06T12:00:00Z");
    assert.equal(inboxTime("2026-10-06T11:59:40Z", now), "now");
    assert.equal(inboxTime("2026-10-06T11:15:00Z", now), "45m");
    assert.equal(inboxTime("2026-10-06T07:00:00Z", now), "5h");
    assert.equal(inboxTime("2026-10-04T12:00:00Z", now), "2d");
    assert.equal(inboxTime("2026-09-20T12:00:00Z", now), "Sep 20");
});

test("resolveActive waits for a load that started after the latest open before falling back", () => {
    const { active } = buildInbox([project("a")], [], ME);
    // A just-joined project isn't in the stale inbox yet: wait, don't fall back.
    assert.deepEqual(resolveActive(active, "new", false), { item: undefined, fallBack: false });
    // The fresh load still doesn't have it: the viewer can't see it.
    assert.deepEqual(resolveActive(active, "new", true), { item: undefined, fallBack: true });
    assert.equal(resolveActive(active, "a", false).item?.id, "a");
    assert.deepEqual(resolveActive(null, "a", true), { item: undefined, fallBack: false });
    assert.deepEqual(resolveActive(active, null, true), { item: undefined, fallBack: false });
});

test("unreadByProject maps every project to its count", () => {
    const { active, closed } = buildInbox([project("a"), project("b", { status: "completed" })], [row("a", { unread: 3 })], ME);
    assert.deepEqual(unreadByProject([...active, ...closed]), { a: 3, b: 0 });
});
