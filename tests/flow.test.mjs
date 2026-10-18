import { test } from "node:test";
import assert from "node:assert/strict";
import { daysPerTask, flowSummary, journeyDays, median, openNow, reworkDays, scopeFlow, stepMedians, stepOf, visits, weekStarts } from "../lib/flow.ts";

const TODAY = "2026-10-15"; // a Thursday
/** 02:00Z is 10:00 in Manila: the same calendar date. */
const at = (date, hour = 2) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;
const task = (o = {}) => ({ id: "t1", project_id: "p1", title: "Upper cabinets", stage: "to_do", assigned_to: "ana", due_date: null, completed_at: null, created_at: at("2026-10-01"), updated_at: at("2026-10-01"), ...o });
const move = (task_id, from, to, date, hour) => ({ task_id, from, to, at: at(date, hour) });

// t1: created Oct 1, started Oct 4, submitted Oct 9, sent back Oct 10, resubmitted Oct 12, accepted Oct 14.
const t1 = task({ stage: "done", completed_at: at("2026-10-14"), due_date: "2026-10-13" });
const t1Moves = [
    move("t1", "to_do", "in_progress", "2026-10-04"),
    move("t1", "in_progress", "review", "2026-10-09"),
    move("t1", "review", "in_progress", "2026-10-10"),
    move("t1", "in_progress", "review", "2026-10-12"),
    move("t1", "review", "done", "2026-10-14"),
];
// t2: created in backlog Oct 2, moved to to-do Oct 3 (same step), started Oct 8, accepted on time Oct 11.
const t2 = task({ id: "t2", stage: "done", assigned_to: "rico", created_at: at("2026-10-02"), completed_at: at("2026-10-11"), due_date: "2026-10-12" });
const t2Moves = [
    move("t2", "backlog", "to_do", "2026-10-03"),
    move("t2", "to_do", "in_progress", "2026-10-08"),
    move("t2", "in_progress", "review", "2026-10-10"),
    move("t2", "review", "done", "2026-10-11"),
];

test("stepOf folds backlog into To do and puts done after the three steps", () => {
    assert.deepEqual(["backlog", "to_do", "in_progress", "review", "done"].map(stepOf), [0, 0, 1, 2, 3]);
});

test("visits follow the moves, skip moves inside a step, and leave the current step open", () => {
    const vs = visits([t2, task({ id: "t3", stage: "in_progress" })], [...t2Moves, move("t3", "to_do", "in_progress", "2026-10-13")]);
    assert.deepEqual(vs.filter((v) => v.task === "t2").map((v) => [v.step, v.start?.slice(0, 10), v.end?.slice(0, 10)]), [
        [0, "2026-10-02", "2026-10-08"],
        [1, "2026-10-08", "2026-10-10"],
        [2, "2026-10-10", "2026-10-11"],
    ]);
    assert.deepEqual(vs.filter((v) => v.task === "t3").map((v) => [v.step, v.end]), [[0, at("2026-10-13")], [1, null]]);
});

test("a task whose first logged move leaves a later step has no known start for it", () => {
    const [v] = visits([task({ stage: "done" })], [move("t1", "review", "done", "2026-10-05")]);
    assert.deepEqual([v.step, v.start], [2, null]);
});

test("median handles odd, even and empty lists", () => {
    assert.equal(median([3, 1, 2]), 2);
    assert.equal(median([4, 1, 2, 3]), 2.5);
    assert.equal(median([]), null);
});

test("stepMedians counts stays that ended in the window, by step", () => {
    const vs = visits([t1, t2], [...t1Moves, ...t2Moves]);
    // To do: t1 3 days, t2 6 days. In progress: t1 5 and 2, t2 2. Review: t1 1 and 2, t2 1.
    assert.deepEqual(stepMedians(vs, "2026-10-01", TODAY), [4.5, 2, 1]);
    assert.deepEqual(stepMedians(vs, "2026-10-13", TODAY), [null, null, 2]);
});

test("journeyDays adds the known steps", () => {
    assert.equal(journeyDays([4.5, 2, 1]), 7.5);
    assert.equal(journeyDays([null, 2, null]), 2);
    assert.equal(journeyDays([null, null, null]), null);
});

test("openNow times the current step from the latest move into it, longest first", () => {
    const open = openNow([
        task({ id: "a", stage: "review", updated_at: at("2026-10-14") }),
        task({ id: "b", stage: "review" }),
        task({ id: "c", stage: "backlog", created_at: at("2026-10-12") }),
    ], [move("a", "in_progress", "review", "2026-10-10")], TODAY);
    assert.deepEqual(open[2].map((o) => [o.task.id, o.days]), [["b", 14], ["a", 5]]);
    assert.deepEqual(open[0].map((o) => [o.task.id, o.days]), [["c", 3]]);
    assert.equal(open[1].length, 0);
});

test("reworkDays is the mean wait from a send-back to the next submission", () => {
    assert.equal(reworkDays(t1Moves, "2026-10-01", TODAY), 2);
    assert.equal(reworkDays([move("x", "review", "in_progress", "2026-10-14")], "2026-10-01", TODAY), null);
});

test("weekStarts gives Monday-start weeks ending with today's", () => {
    assert.deepEqual(weekStarts(TODAY, 3), ["2026-09-28", "2026-10-05", "2026-10-12"]);
    assert.deepEqual(weekStarts("2026-10-12", 1), ["2026-10-12"]);
});

test("flowSummary counts the period, the period before, and the weeks", () => {
    const old = task({ id: "t0", stage: "done", created_at: at("2026-09-01"), completed_at: at("2026-09-20"), due_date: "2026-09-15" });
    const s = flowSummary([t1, t2, old], [...t1Moves, ...t2Moves, move("t0", "in_progress", "review", "2026-09-18"), move("t0", "review", "in_progress", "2026-09-19")], TODAY, 14);
    assert.deepEqual([s.now.accepted, s.now.onTime, s.now.submitted, s.now.sentBack], [2, 1, 3, 1]);
    assert.deepEqual([s.before.accepted, s.before.onTime, s.before.submitted, s.before.sentBack], [1, 0, 1, 1]);
    assert.equal(s.reworkDays, 2);
    assert.deepEqual(s.weeks, ["2026-10-05", "2026-10-12"]);
    assert.deepEqual(s.weekly.accepted, [1, 1]);
    assert.deepEqual(s.weekly.acceptedBefore, [0, 0]);
    assert.deepEqual(s.weekly.sentBack, [1, 0]);
    assert.deepEqual(s.weekly.onTime, [1, 0]);
});

test("scopeFlow keeps one person's tasks and only their moves", () => {
    const { tasks, moves } = scopeFlow([t1, t2], [...t1Moves, ...t2Moves], (t) => t.assigned_to === "rico");
    assert.deepEqual(tasks.map((t) => t.id), ["t2"]);
    assert.equal(moves.length, t2Moves.length);
    assert.equal(daysPerTask(tasks, moves, TODAY, 30), 2);
});
