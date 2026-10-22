import { test } from "node:test";
import assert from "node:assert/strict";
import { buildPeriods, groupMoves, periodOf, periodStats, rangeLabel, stageOn, timelineSpan } from "../lib/project-timeline.ts";

const TODAY = "2026-08-12";
const project = { id: "p1", title: "Kitchen", start: "2026-07-10", end: "2026-08-06", completedAt: null, active: true };

test("weeks run from the start and stretch past the due date to today", () => {
    const span = timelineSpan(project, [], TODAY);
    assert.deepEqual(span, { from: "2026-07-10", to: TODAY });
    const weeks = buildPeriods(span, project.end, "week", TODAY);
    assert.deepEqual(weeks.map((w) => [w.label, w.from, w.to]), [
        ["Week 1", "2026-07-10", "2026-07-16"], ["Week 2", "2026-07-17", "2026-07-23"], ["Week 3", "2026-07-24", "2026-07-30"],
        ["Week 4", "2026-07-31", "2026-08-06"], ["Week 5", "2026-08-07", "2026-08-12"],
    ]);
    assert.equal(weeks[4].beyond, true);
    assert.equal(weeks[4].current, true);
    assert.equal(periodOf(weeks, project.end), 3);
    assert.equal(rangeLabel("2026-07-31", "2026-08-06"), "Jul 31 – Aug 6");
    assert.equal(rangeLabel("2026-07-10", "2026-07-16"), "Jul 10 – 16");
});

test("days run one by one from the start, labelled by weekday", () => {
    const days = buildPeriods({ from: "2026-08-10", to: TODAY }, project.end, "day", TODAY);
    assert.deepEqual(days.map((d) => [d.label, d.from, d.to, d.range]), [["Day 1", "2026-08-10", "2026-08-10", "Mon, Aug 10"], ["Day 2", "2026-08-11", "2026-08-11", "Tue, Aug 11"], ["Day 3", TODAY, TODAY, "Wed, Aug 12"]]);
    assert.equal(days[2].current, true);
});

test("months are calendar months clipped to the span", () => {
    const months = buildPeriods({ from: "2026-07-10", to: "2026-09-03" }, "2026-08-31", "month", TODAY);
    assert.deepEqual(months.map((m) => [m.label, m.from, m.to]), [["Jul 2026", "2026-07-10", "2026-07-31"], ["Aug 2026", "2026-08-01", "2026-08-31"], ["Sep 2026", "2026-09-01", "2026-09-03"]]);
    assert.equal(months[2].upcoming, true);
});

test("a task's stage on a day comes from its moves", () => {
    const task = { id: "t1", project_id: "p1", title: "Tiles", stage: "done", assigned_to: null, due_date: "2026-07-20", created_at: "2026-07-10T01:00:00Z" };
    const moves = [
        { task_id: "t1", from: "to_do", to: "in_progress", at: "2026-07-14T02:00:00Z" },
        { task_id: "t1", from: "in_progress", to: "done", at: "2026-07-25T02:00:00Z" },
    ];
    assert.equal(stageOn(task, moves, "2026-07-09"), null);
    assert.equal(stageOn(task, moves, "2026-07-12"), "to_do");
    assert.equal(stageOn(task, moves, "2026-07-20"), "in_progress");
    assert.equal(stageOn(task, moves, "2026-07-30"), "done");

    const weeks = buildPeriods({ from: "2026-07-10", to: TODAY }, project.end, "week", TODAY);
    const log = [{ project_id: "p1", action_type: "task_moved", details: { to: "done" }, created_at: "2026-07-25T02:00:00Z" }];
    const byTask = groupMoves(moves);
    // Week 2 (Jul 17 – 23): still in progress past its Jul 20 due date.
    assert.deepEqual(periodStats(weeks[1], [task], byTask, log, TODAY), { activities: 0, accepted: 0, open: { to_do: 0, in_progress: 1, review: 0 }, overdue: 1, due: 1, kinds: [] });
    // Week 3: accepted, nothing open.
    const w3 = periodStats(weeks[2], [task], byTask, log, TODAY);
    assert.equal(w3.accepted, 1);
    assert.equal(w3.overdue, 0);
    assert.deepEqual(w3.kinds, ["review"]);
});

test("a period marks the phases delivered, due or missed in it and the last status update", async () => {
    const { periodMarks } = await import("../lib/project-timeline.ts");
    const weeks = buildPeriods({ from: "2026-07-10", to: TODAY }, project.end, "week", TODAY);
    const phases = [
        { project_id: "p1", title: "Carpentry", due_date: "2026-07-20", completed_at: "2026-07-25T02:00:00Z" },
        { project_id: "p1", title: "Finishes", due_date: "2026-08-12", completed_at: null },
    ];
    const rows = [
        { project_id: "p1", action_type: "project_update", details: { health: "on_track", note: "Fine" }, created_at: "2026-07-18T01:00:00Z" },
        { project_id: "p1", action_type: "project_update", details: { health: "at_risk", note: "Tiles late" }, created_at: "2026-07-20T01:00:00Z" },
    ];
    // Week 2 (Jul 17 – 23): Carpentry was due and slipped; the later update wins.
    const w2 = periodMarks(weeks[1], phases, rows, TODAY);
    assert.deepEqual(w2.phases.map((p) => [p.title, p.state]), [["Carpentry", "missed"]]);
    assert.equal(w2.phases[0].text, "Carpentry was due Jul 20 · delivered Jul 25");
    assert.deepEqual(w2.health, { health: "at_risk", label: "At risk", note: "Tiles late" });
    // Week 3: delivered, five days late.
    assert.equal(periodMarks(weeks[2], phases, [], TODAY).phases[0].text, "Carpentry delivered Jul 25 · 5 days late");
    // Week 5 holds today: Finishes is due, not missed yet.
    assert.deepEqual(periodMarks(weeks[4], phases, [], TODAY).phases.map((p) => p.state), ["due"]);
});
