import { test } from "node:test";
import assert from "node:assert/strict";
import { headlines, paceSentence, projectPace, ratio } from "../lib/analytics-insights.ts";

const TODAY = "2026-11-20";
const project = (over = {}) => ({ id: "p", title: "Azure", pm_id: "pm", client_id: "c", status: "in_progress", start_date: "2026-11-11", end_date: "2026-11-30", completed_at: null, ...over });
const task = (stage, due_date = null) => ({ project_id: "p", stage, due_date });

test("ratio rounds honestly: never 0% with progress, never 100% before done", () => {
    assert.deepEqual(ratio(1, 3), { n: 1, of: 3, pct: 33 });
    assert.equal(ratio(1, 400).pct, 1);
    assert.equal(ratio(399, 400).pct, 99);
    assert.equal(ratio(4, 4).pct, 100);
    assert.equal(ratio(0, 4).pct, 0);
    assert.equal(ratio(0, 0).pct, null);
});

test("projectPace compares work done with time used, both counted inclusively", () => {
    // Nov 11 to 30 is 20 days; Nov 11 to 20 is 10 used.
    const p = projectPace(project(), [task("done"), task("to_do"), task("in_progress"), task("review")], TODAY);
    assert.deepEqual(p.time, { n: 10, of: 20, pct: 50 });
    assert.deepEqual(p.work, { n: 1, of: 4, pct: 25 });
    assert.equal(p.gap, -25);
    assert.equal(p.state, "behind");
});

test("projectPace: within 10 points is on pace, more work than time is ahead", () => {
    assert.equal(projectPace(project(), [task("done"), task("to_do")], TODAY).state, "on_pace");
    assert.equal(projectPace(project(), [task("done"), task("done"), task("done"), task("to_do")], TODAY).state, "ahead");
});

test("projectPace counts overdue open work, not work in review", () => {
    const p = projectPace(project(), [task("to_do", "2026-11-18"), task("review", "2026-11-18"), task("done", "2026-11-01")], TODAY);
    assert.equal(p.overdue, 1);
});

test("projectPace: not started, no tasks, past the handover date, delivered", () => {
    assert.equal(projectPace(project({ start_date: "2026-11-25" }), [task("to_do")], TODAY).state, "not_started");
    assert.equal(projectPace(project(), [], TODAY).state, "no_tasks");
    const past = projectPace(project({ end_date: "2026-11-17" }), [task("to_do")], TODAY);
    assert.equal(past.state, "past_end");
    assert.equal(past.daysOver, 3);
    assert.deepEqual(past.time, { n: 7, of: 7, pct: 100 });
    assert.equal(projectPace(project({ completed_at: "2026-11-30T03:00:00Z" }), [task("done")], TODAY).state, "delivered_on_time");
    const late = projectPace(project({ completed_at: "2026-12-02T03:00:00Z" }), [task("done")], TODAY);
    assert.equal(late.state, "delivered_late");
    assert.equal(late.daysOver, 2);
});

test("paceSentence says what the two bars mean in plain words", () => {
    const behind = projectPace(project(), [task("done"), task("to_do"), task("in_progress"), task("review")], TODAY);
    assert.equal(paceSentence(behind), "25% of the work is accepted with 50% of the time used: 25 points behind.");
    assert.match(paceSentence(projectPace(project(), [task("done"), task("to_do")], TODAY)), /in step/);
    assert.match(paceSentence(projectPace(project({ start_date: "2026-11-25" }), [task("to_do")], TODAY)), /Starts Nov 25/);
    assert.match(paceSentence(projectPace(project({ end_date: "2026-11-17" }), [task("to_do")], TODAY)), /3 days past its handover date/);
    assert.match(paceSentence(projectPace(project(), [], TODAY)), /No tasks yet/);
});

test("headlines lead with how the projects stand, then the one that needs attention", () => {
    const azure = { title: "Azure", pace: projectPace(project(), [task("done"), task("to_do", "2026-11-18"), task("in_progress"), task("review")], TODAY) };
    const fine = { title: "Fine", pace: projectPace(project({ id: "q" }), [task("done"), task("to_do")], TODAY) };
    const lines = headlines({ projects: [azure, fine], review: 2, crew: [{ name: "Ana", open: 3, late: 1 }, { name: "Ben", open: 1, late: 0 }], whose: "your" });
    assert.equal(lines[0], "2 active projects: 1 on pace, 1 behind.");
    assert.equal(lines[1], "Azure needs attention: 25 points behind, 1 task overdue.");
    assert.equal(lines[2], "2 tasks are waiting for your review.");
    assert.equal(lines[3], "Ana carries the most open work: 3 tasks, 1 late.");
});

test("headlines when all is well, or nothing is running", () => {
    const fine = { title: "Fine", pace: projectPace(project(), [task("done"), task("to_do")], TODAY) };
    assert.deepEqual(headlines({ projects: [fine], review: 0, crew: [], whose: "their" }), ["1 active project: on pace.", "Nothing is waiting for their review."]);
    assert.deepEqual(headlines({ projects: [], review: 0, crew: [], whose: "your" }), ["No active projects right now."]);
});

test("work already accepted before the start date means the project has started, ahead of schedule", () => {
    const early = projectPace(project({ start_date: "2026-11-25" }), [task("done"), task("to_do")], TODAY);
    assert.equal(early.state, "ahead");
    assert.deepEqual(early.time, { n: 0, of: 6, pct: 0 });
    assert.equal(projectPace(project({ start_date: "2026-11-25" }), [task("in_progress"), task("to_do")], TODAY).state, "not_started");
});

test("milestoneSteps orders milestones by date and says how each stands", async () => {
    const { milestoneSteps } = await import("../lib/analytics-insights.ts");
    const ms = [
        { id: "c", title: "Paint", due_date: "2026-11-25", completed_at: null },
        { id: "a", title: "Survey", due_date: "2026-11-12", completed_at: "2026-11-12T05:00:00Z" },
        { id: "b", title: "Demolish", due_date: "2026-11-15", completed_at: "2026-11-17T05:00:00Z" },
        { id: "d", title: "Tile", due_date: "2026-11-18", completed_at: null },
        { id: "e", title: "Today one", due_date: TODAY, completed_at: null },
    ];
    const tasks = [{ milestone_id: "c", stage: "done" }, { milestone_id: "c", stage: "to_do" }, { milestone_id: null, stage: "done" }];
    const steps = milestoneSteps(ms, tasks, TODAY);
    assert.deepEqual(steps.map((s) => [s.id, s.state, s.days]), [["a", "on_time", 0], ["b", "late", 2], ["d", "missed", 2], ["e", "due", 0], ["c", "due", 5]]);
    assert.deepEqual(steps[4].tasks, { n: 1, of: 2, pct: 50 });
});

test("stepPhrase words each state plainly", async () => {
    const { stepPhrase } = await import("../lib/analytics-insights.ts");
    const s = (state, days, done = null) => ({ id: "x", title: "X", due: "2026-11-15", done, state, days, tasks: ratio(0, 0) });
    assert.equal(stepPhrase(s("on_time", 0, "2026-11-14")), "Delivered Nov 14, on time");
    assert.equal(stepPhrase(s("late", 2, "2026-11-17")), "Delivered Nov 17, 2 days late");
    assert.equal(stepPhrase(s("missed", 3)), "Not delivered, 3 days overdue");
    assert.equal(stepPhrase(s("due", 0)), "Due today");
    assert.equal(stepPhrase(s("due", 1)), "Due tomorrow, Nov 15");
    assert.equal(stepPhrase(s("due", 5)), "Due in 5 days, Nov 15");
});

test("timelineSentence says where the project is and what comes next", async () => {
    const { milestoneSteps, timelineSentence } = await import("../lib/analytics-insights.ts");
    const ms = [{ id: "a", title: "Survey", due_date: "2026-11-12", completed_at: "2026-11-12T05:00:00Z" }, { id: "b", title: "Tile", due_date: "2026-11-18", completed_at: null }, { id: "c", title: "Paint", due_date: "2026-11-25", completed_at: null }];
    const steps = milestoneSteps(ms, [], TODAY);
    assert.equal(timelineSentence({ start: "2026-11-11", end: "2026-11-30", completedAt: null }, steps, TODAY),
        "Day 10 of 20. 1 of 3 milestones delivered, 1 missed. Next: Paint, due Nov 25.");
    assert.equal(timelineSentence({ start: "2026-11-25", end: "2026-11-30", completedAt: null }, [], TODAY), "Starts in 5 days, on Nov 25. No milestones set yet.");
    assert.equal(timelineSentence({ start: "2026-11-01", end: "2026-11-17", completedAt: null }, steps, TODAY), "3 days past its handover date. 1 of 3 milestones delivered, 1 missed. Next: Paint, due Nov 25.");
    assert.equal(timelineSentence({ start: "2026-11-01", end: "2026-11-17", completedAt: "2026-11-17T03:00:00Z" }, [], TODAY), "Handed over Nov 17. No milestones set yet.");
});

test("throughputFacts: average, last 4 weeks against the 4 before, busiest week, quiet weeks", async () => {
    const { throughputFacts } = await import("../lib/analytics-insights.ts");
    const accepted = [0, 0, 0, 0, 1, 0, 2, 1, 3, 0, 2, 1];
    const added = [1, 0, 0, 2, 1, 1, 2, 2, 1, 1, 1, 0];
    const f = throughputFacts(accepted, added);
    assert.equal(f.accepted, 10);
    assert.equal(f.added, 12);
    assert.equal(f.average, 0.8);
    assert.deepEqual(f.recent, { now: 6, before: 4 });
    assert.equal(f.busiest, 8);
    assert.equal(f.quiet, 6);
    assert.equal(f.trend, "faster");
});

test("throughputFacts: slower, steady, and nothing at all", async () => {
    const { throughputFacts } = await import("../lib/analytics-insights.ts");
    assert.equal(throughputFacts([0, 0, 0, 0, 2, 2, 2, 2, 1, 0, 0, 0], Array(12).fill(0)).trend, "slower");
    assert.equal(throughputFacts([0, 0, 0, 0, 1, 1, 0, 0, 1, 0, 1, 0], Array(12).fill(0)).trend, "steady");
    const none = throughputFacts(Array(12).fill(0), Array(12).fill(0));
    assert.equal(none.busiest, null);
    assert.equal(none.trend, "none");
});
