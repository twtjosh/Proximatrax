import { test } from "node:test";
import assert from "node:assert/strict";
import { changedTaskIds, isOwnChange, noteOwnChange } from "../lib/live-changes.ts";

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
