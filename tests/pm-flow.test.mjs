import { test } from "node:test";
import assert from "node:assert/strict";
import { parseQuickAdd } from "../lib/quick-add.ts";
import { dateToFraction, fractionToDate, milestoneSpans, monthTicks, shiftLabel, timelineRange } from "../lib/schedule.ts";
import { peopleLoad } from "../lib/people-load.ts";
import { reviewQueue, sendBackChecklist } from "../lib/review-queue.ts";
import { nextHandoffAction, taskBlockedReason, validateStageTransition } from "../lib/board-workflow.ts";

const TODAY = "2026-10-14"; // a Wednesday
const people = [{ id: "z", name: "Ziven Perreras" }, { id: "l", name: "Lea Santos" }];
const milestones = [{ id: "m1", title: "Site Survey" }, { id: "m2", title: "Construction" }];
const ctx = { people, milestones, today: TODAY };

test("quick add: person, milestone and weekday come out of the title", () => {
    const p = parseQuickAdd("Install vanity @ziv #constr fri", ctx);
    assert.equal(p.title, "Install vanity");
    assert.equal(p.assigneeId, "z");
    assert.equal(p.milestoneId, "m2");
    assert.equal(p.dueDate, "2026-10-16");
    assert.deepEqual(p.tokens.map((t) => [t.kind, t.label]), [["person", "Ziven Perreras"], ["milestone", "Construction"], ["date", "Fri, Oct 16"]]);
});

test("quick add: day words and dates", () => {
    assert.equal(parseQuickAdd("a today", ctx).dueDate, "2026-10-14");
    assert.equal(parseQuickAdd("a tomorrow", ctx).dueDate, "2026-10-15");
    assert.equal(parseQuickAdd("a wed", ctx).dueDate, "2026-10-21");
    assert.equal(parseQuickAdd("a oct 26", ctx).dueDate, "2026-10-26");
    assert.equal(parseQuickAdd("a 10/26", ctx).dueDate, "2026-10-26");
    assert.equal(parseQuickAdd("a jan 5", ctx).dueDate, "2027-01-05");
    assert.equal(parseQuickAdd("a 2026-11-02", ctx).dueDate, "2026-11-02");
});

test("quick add: unknown names stay in the title; milestone words ignore spacing and case", () => {
    const p = parseQuickAdd("Fix @nobody leak", ctx);
    assert.equal(p.title, "Fix @nobody leak");
    assert.equal(p.assigneeId, null);
    assert.equal(parseQuickAdd("Measure #site-survey", ctx).milestoneId, "m1");
    assert.equal(parseQuickAdd("Measure #SITESURVEY", ctx).milestoneId, "m1");
});

test("quick add: an empty or token-only line has no title", () => {
    assert.equal(parseQuickAdd("   ", ctx).title, "");
    assert.equal(parseQuickAdd("@lea fri", ctx).title, "");
});

test("schedule: each bar runs from the previous milestone (or the project start) to its due date", () => {
    const ms = [{ id: "b", due_date: "2026-10-24" }, { id: "a", due_date: "2026-10-20" }];
    assert.deepEqual(milestoneSpans(ms, "2026-10-19"), [{ id: "a", start: "2026-10-19", end: "2026-10-20" }, { id: "b", start: "2026-10-20", end: "2026-10-24" }]);
    assert.deepEqual(milestoneSpans([{ id: "x", due_date: "2026-10-10" }], "2026-10-19"), [{ id: "x", start: "2026-10-10", end: "2026-10-10" }]);
});

test("schedule: range pads the project window and every due date; date and fraction convert both ways, snapped to days", () => {
    const range = timelineRange("2026-10-19", "2026-10-27", [{ due_date: "2026-11-02" }]);
    assert.deepEqual(range, { from: "2026-10-16", to: "2026-11-05" });
    assert.equal(dateToFraction("2026-10-16", range), 0);
    assert.equal(dateToFraction("2026-11-05", range), 1);
    assert.equal(fractionToDate(0.5, range), "2026-10-26");
    assert.equal(fractionToDate(-1, range), "2026-10-16");
    assert.equal(fractionToDate(2, range), "2026-11-05");
});

test("schedule: shift label and month ticks", () => {
    assert.equal(shiftLabel("2026-10-24", "2026-10-26"), "+2d");
    assert.equal(shiftLabel("2026-10-24", "2026-10-21"), "−3d");
    assert.equal(shiftLabel("2026-10-24", "2026-10-24"), "");
    const ticks = monthTicks({ from: "2026-10-16", to: "2026-12-05" });
    assert.deepEqual(ticks.map((t) => t.date), ["2026-11-01", "2026-12-01"]);
    assert.equal(ticks[0].label, "Nov");
});

test("people load: PM and client first, then crew busiest first, with open, late and in-review counts", () => {
    const team = [
        { id: "c", name: "Client", role: "Client" },
        { id: "l", name: "Lea", role: "Middleman" },
        { id: "pm", name: "PM", role: "Project manager" },
        { id: "z", name: "Ziven", role: "Middleman" },
    ];
    const tasks = [
        { assigned_to: "z", stage: "in_progress", due_date: "2026-10-10" },
        { assigned_to: "z", stage: "review", due_date: "2026-10-01" },
        { assigned_to: "z", stage: "done", due_date: null },
        { assigned_to: "l", stage: "to_do", due_date: null },
    ];
    const load = peopleLoad(team, tasks, TODAY);
    assert.deepEqual(load.map((p) => [p.id, p.open, p.late, p.review]), [["pm", 0, 0, 0], ["c", 0, 0, 0], ["z", 2, 1, 1], ["l", 1, 0, 0]]);
});

test("review queue: tasks in review, oldest submission first", () => {
    const q = reviewQueue([
        { id: "a", stage: "review", updated_at: "2026-10-13T05:00:00Z" },
        { id: "b", stage: "done", updated_at: "2026-10-01T00:00:00Z" },
        { id: "c", stage: "review", updated_at: "2026-10-12T05:00:00Z" },
    ]);
    assert.deepEqual(q.map((t) => t.id), ["c", "a"]);
});

test("send back: the reason becomes the first, unticked checklist item", () => {
    const list = sendBackChecklist([{ id: "1", label: "Grout", done: true }], "  Redo the finish ", "fix-1");
    assert.deepEqual(list, [{ id: "fix-1", label: "Fix: Redo the finish", done: false }, { id: "1", label: "Grout", done: true }]);
});

const gate = {
    milestones: [{ id: "m1", title: "Site Survey", due_date: "2026-10-20", completed: false }, { id: "m2", title: "Construction", due_date: "2026-10-24", completed: false }],
    tasks: [{ id: "s1", milestone_id: "m1", stage: "in_progress" }, { id: "t", milestone_id: "m2", stage: "in_progress" }, { id: "u", milestone_id: "m2", stage: "to_do" }],
};

test("gate: starting later-milestone work is blocked for crew, allowed for the PM with a warning", () => {
    const todo = { id: "u", milestone_id: "m2", stage: "to_do", assigned_to: "crew" };
    const crew = validateStageTransition(todo, "to_do", "in_progress", "middleman", gate);
    assert.equal(crew.ok, false);
    const pm = validateStageTransition(todo, "to_do", "in_progress", "project_manager", gate);
    assert.equal(pm.ok, true);
    assert.match(pm.warning, /Site Survey/);
});

test("gate: work already started can still be submitted and accepted out of order", () => {
    const started = { id: "t", milestone_id: "m2", stage: "in_progress", assigned_to: "crew" };
    assert.equal(validateStageTransition(started, "in_progress", "review", "middleman", gate).ok, true);
    assert.equal(validateStageTransition({ ...started, stage: "review" }, "review", "done", "project_manager", gate).ok, true);
    assert.equal(nextHandoffAction(started, "middleman", "crew", gate)?.variant, "submit");
    assert.equal(taskBlockedReason(started, "project_manager", gate), null);
    assert.equal(taskBlockedReason({ id: "u", milestone_id: "m2", stage: "to_do", assigned_to: "crew" }, "project_manager", gate), "Waits for Site Survey");
});
