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
