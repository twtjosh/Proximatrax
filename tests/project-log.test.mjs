import { test } from "node:test";
import assert from "node:assert/strict";
import { isChatRow } from "../lib/project-log.ts";

test("chat stays out of the activity log: messages and photos sent in chat, not task or file uploads", () => {
    const row = (action_type, details = {}) => ({ action_type, details, created_at: "2026-07-10T01:00:00Z" });
    assert.equal(isChatRow(row("message_sent")), true);
    assert.equal(isChatRow(row("file_uploaded", { file_name: "IMG_1.jpg", message_id: "m1" })), true);
    assert.equal(isChatRow(row("file_uploaded", { file_name: "IMG_2.jpg", task_id: "t1", source: "task_board" })), false);
    assert.equal(isChatRow(row("file_uploaded", { file_name: "plan.pdf", source: "files" })), false);
    assert.equal(isChatRow(row("task_moved", { to: "done" })), false);
});
