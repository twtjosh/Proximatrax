import { test } from "node:test";
import assert from "node:assert/strict";
import { agendaBucket, agendaCounts, agendaGroups, bucketNote, matchesAgendaFilter, relativeDue } from "../lib/task-agenda.ts";

const TODAY = "2026-10-16";
const t = (o = {}) => ({ id: "t", stage: "to_do", due_date: null, assigned_to: "z", position: 0, ...o });

test("agendaBucket: done and review win over dates; then late, this week, next week, later, no date", () => {
    assert.equal(agendaBucket(t({ stage: "done", due_date: "2026-10-01" }), TODAY), "done");
    assert.equal(agendaBucket(t({ stage: "review", due_date: "2026-10-01" }), TODAY), "review");
    assert.equal(agendaBucket(t({ due_date: "2026-10-15" }), TODAY), "late");
    assert.equal(agendaBucket(t({ due_date: TODAY }), TODAY), "week");
    assert.equal(agendaBucket(t({ due_date: "2026-10-22" }), TODAY), "week");
    assert.equal(agendaBucket(t({ due_date: "2026-10-23" }), TODAY), "next");
    assert.equal(agendaBucket(t({ due_date: "2026-10-29" }), TODAY), "next");
    assert.equal(agendaBucket(t({ due_date: "2026-10-30" }), TODAY), "later");
    assert.equal(agendaBucket(t({ stage: "in_progress" }), TODAY), "none");
});

test("agendaGroups: only non-empty groups, in attention order, soonest first inside", () => {
    const ts = [
        t({ id: "a", due_date: "2026-11-10" }),
        t({ id: "b", due_date: "2026-10-14" }),
        t({ id: "c", stage: "review", due_date: "2026-10-15" }),
        t({ id: "d", due_date: "2026-11-02", position: 2 }),
        t({ id: "e", due_date: "2026-11-02", position: 1 }),
        t({ id: "f", stage: "done", due_date: "2026-10-12" }),
    ];
    assert.deepEqual(agendaGroups(ts, TODAY).map((g) => [g.key, g.tasks.map((x) => x.id)]), [
        ["late", ["b"]], ["review", ["c"]], ["later", ["e", "d", "a"]], ["done", ["f"]],
    ]);
    assert.deepEqual(agendaGroups([], TODAY), []);
});

test("agendaCounts and the filters they drive", () => {
    const ts = [
        t({ id: "a", due_date: "2026-10-14" }),
        t({ id: "b", stage: "review" }),
        t({ id: "c", due_date: "2026-10-20", assigned_to: null }),
        t({ id: "d", stage: "done", assigned_to: null }),
    ];
    assert.deepEqual(agendaCounts(ts, TODAY), { late: 1, review: 1, week: 1, unassigned: 1 });
    assert.deepEqual(ts.filter((x) => matchesAgendaFilter(x, "unassigned", TODAY)).map((x) => x.id), ["c"]);
    assert.deepEqual(ts.filter((x) => matchesAgendaFilter(x, "late", TODAY)).map((x) => x.id), ["a"]);
    assert.equal(ts.every((x) => matchesAgendaFilter(x, null, TODAY)), true);
});

test("bucketNote: the dates a week bucket covers", () => {
    assert.equal(bucketNote("week", TODAY), "Due by Oct 22");
    assert.equal(bucketNote("next", TODAY), "Due Oct 23 to Oct 29");
    assert.equal(bucketNote("review", TODAY), "Submitted by the crew");
});

test("relativeDue", () => {
    assert.equal(relativeDue("2026-10-14", "to_do", TODAY), "2 days late");
    assert.equal(relativeDue("2026-10-15", "in_progress", TODAY), "1 day late");
    assert.equal(relativeDue(TODAY, "to_do", TODAY), "Due today");
    assert.equal(relativeDue("2026-10-17", "to_do", TODAY), "Due tomorrow");
    assert.equal(relativeDue("2026-10-20", "to_do", TODAY), "In 4 days");
    assert.equal(relativeDue("2026-10-30", "to_do", TODAY), "In 2 weeks");
    assert.equal(relativeDue("2026-10-01", "done", TODAY), "Accepted");
    assert.equal(relativeDue(null, "to_do", TODAY), "No due date");
});
