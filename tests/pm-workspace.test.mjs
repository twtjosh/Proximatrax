import { test } from "node:test";
import assert from "node:assert/strict";
import { forecastHandover, onSiteNow, progressSeries } from "../lib/project-insights.ts";
import { latestUpdate, logDetail, logKind, logSentence } from "../lib/project-log.ts";

const task = (stage, accepted) => ({ stage, updated_at: `${accepted ?? "2026-10-01"}T08:00:00Z`, client_visible_at: accepted ? `${accepted}T09:00:00Z` : null });

test("forecast: none before anything is accepted", () => {
    assert.equal(forecastHandover("2026-10-01", "2026-11-01", [task("to_do"), task("in_progress")], "2026-10-11"), null);
});

test("forecast: projects the pace so far", () => {
    // 2 of 4 accepted in 10 days: 0.2/day, 2 left = 10 more days.
    const tasks = [task("done", "2026-10-05"), task("done", "2026-10-09"), task("to_do"), task("review")];
    assert.deepEqual(forecastHandover("2026-10-01", "2026-10-15", tasks, "2026-10-11"), { date: "2026-10-21", slip: 6 });
});

test("forecast: all accepted lands on the last acceptance", () => {
    const tasks = [task("done", "2026-10-05"), task("done", "2026-10-08")];
    assert.deepEqual(forecastHandover("2026-10-01", "2026-10-15", tasks, "2026-10-11"), { date: "2026-10-08", slip: -7 });
});

test("progress: weekly points up to today against the straight plan", () => {
    const tasks = [task("done", "2026-10-03"), task("done", "2026-10-10"), task("to_do"), task("to_do")];
    const s = progressSeries("2026-10-01", "2026-10-29", tasks, "2026-10-12");
    assert.deepEqual(s, [
        { date: "2026-10-01", accepted: 0, planned: 0 },
        { date: "2026-10-08", accepted: 1, planned: 1 },
        { date: "2026-10-12", accepted: 2, planned: 2 },
    ]);
});

test("on site now: busiest first, no one last", () => {
    const t = (assigned_to, stage = "in_progress") => ({ assigned_to, stage });
    const groups = onSiteNow([t("a"), t(null), t("b"), t("b"), t("a", "done")]);
    assert.deepEqual(groups.map((g) => [g.person, g.tasks.length]), [["b", 2], ["a", 1], [null, 1]]);
});

test("log: reviews read as reviews", () => {
    const row = (details) => ({ action_type: "task_moved", details, created_at: "2026-10-14T00:00:00Z" });
    assert.equal(logSentence(row({ title: "Tile", from: "review", to: "done" })), "accepted “Tile”");
    assert.equal(logKind(row({ from: "review", to: "in_progress" })), "review");
    assert.equal(logDetail(row({ from: "review", to: "in_progress", reason: " Redo the grout " })), "Redo the grout");
    assert.equal(logKind(row({ from: "to_do", to: "in_progress" })), "task");
    assert.equal(logSentence(row({ title: "Tile", from: "to_do", to: "in_progress" })), "started “Tile”");
});

test("log: the latest valid status update wins", () => {
    const rows = [
        { action_type: "task_created", details: {}, created_at: "2026-10-14T03:00:00Z" },
        { action_type: "project_update", details: { health: "nope" }, created_at: "2026-10-14T02:00:00Z" },
        { action_type: "project_update", details: { health: "at_risk", note: "Tiles delayed" }, created_at: "2026-10-13T02:00:00Z", user_id: "pm" },
    ];
    assert.deepEqual(latestUpdate(rows), { health: "at_risk", note: "Tiles delayed", at: "2026-10-13T02:00:00Z", by: "pm" });
    assert.equal(logSentence(rows[2]), "posted an update: At risk");
});
