import { test } from "node:test";
import assert from "node:assert/strict";
import { changedTaskIds, isOwnChange, noteOwnChange, taskAnnouncement } from "../lib/live-changes.ts";

const row = (o) => ({ id: "t1", project_id: "p1", title: "Tile the kitchen", stage: "review", assigned_to: "crew", ...o });

test("PM hears about a submission, and only a fresh one", () => {
    assert.equal(taskAnnouncement({ stage: "in_progress" }, row(), { role: "pm" })?.kind, "submitted");
    assert.equal(taskAnnouncement({ stage: "review" }, row(), { role: "pm" }), null, "an edit while in review is not a new submission");
    assert.equal(taskAnnouncement({ stage: "review" }, row({ stage: "done" }), { role: "pm" }), null);
    assert.equal(taskAnnouncement({ id: "t1" }, row(), { role: "pm" }), null, "no old stage (replica identity default): stay quiet");
    assert.equal(taskAnnouncement(undefined, row(), { role: "pm" }), null);
});

test("crew hears the PM's decision on their own work", () => {
    const me = { role: "crew", viewerId: "crew" };
    assert.equal(taskAnnouncement({ stage: "review" }, row({ stage: "done" }), me)?.kind, "accepted");
    assert.equal(taskAnnouncement({ stage: "review" }, row({ stage: "in_progress" }), me)?.kind, "sent_back");
    assert.equal(taskAnnouncement({ stage: "review" }, row({ stage: "done", assigned_to: "someone" }), me), null);
    assert.equal(taskAnnouncement({ stage: "to_do" }, row({ stage: "in_progress" }), me), null, "starting work is not a decision");
});

test("changed ids: server edits and new tasks, not the local copy's own state", () => {
    const base = { title: "A", stage: "to_do", assigned_to: null, due_date: null, priority: "normal", checklist: [{ id: "c", label: "x", done: false }] };
    const local = [{ id: "a", ...base }, { id: "b", ...base }];
    const server = [
        { id: "a", ...base, checklist: [{ done: false, label: "x", id: "c" }] },
        { id: "b", ...base, stage: "review" },
        { id: "c", ...base },
    ];
    assert.deepEqual(changedTaskIds(local, server), ["b", "c"]);
});

test("own changes are muted briefly", () => {
    noteOwnChange("t9", 1_000);
    assert.equal(isOwnChange("t9", 4_000), true);
    assert.equal(isOwnChange("t9", 7_000), false, "a teammate's later change is not muted");
    assert.equal(isOwnChange("other", 5_000), false);
});
