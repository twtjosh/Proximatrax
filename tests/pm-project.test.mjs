import { test } from "node:test";
import assert from "node:assert/strict";
import { calendarPhrase, journeyProgress, journeyStations, projectNeeds, projectStage, quickPickDates } from "../lib/pm-project.ts";

const TODAY = "2026-09-24"; // a Thursday
const task = (over) => ({
    id: over.id, title: over.title ?? over.id, project_id: "p1", stage: over.stage ?? "to_do",
    due_date: over.due_date ?? null, client_visible_at: null, updated_at: over.updated_at ?? "2026-09-20T00:00:00Z",
    assigned_to: over.assigned_to ?? null, milestone_id: over.milestone_id ?? null,
});
const ms = (over) => ({ id: over.id, title: over.title ?? over.id, project_id: "p1", due_date: over.due_date, completed: over.completed ?? false });

test("stage: closed beats everything", () => {
    assert.equal(projectStage("completed", [], []), "closed");
});

test("stage: setup while invites are out or nothing is laid out", () => {
    assert.equal(projectStage("pending_invites", [ms({ id: "m", due_date: TODAY })], [task({ id: "t" })]), "setup");
    assert.equal(projectStage("in_progress", [], [task({ id: "t" })]), "setup");
    assert.equal(projectStage("in_progress", [ms({ id: "m", due_date: TODAY })], []), "setup");
});

test("stage: ready when every milestone is delivered and all work accepted, else running", () => {
    const delivered = [ms({ id: "m", due_date: TODAY, completed: true })];
    assert.equal(projectStage("in_progress", delivered, [task({ id: "t", stage: "done" })]), "ready");
    assert.equal(projectStage("in_progress", delivered, [task({ id: "t", stage: "review" })]), "running");
});

test("stations: sorted by due date with state and linked task progress", () => {
    const stations = journeyStations(
        [ms({ id: "b", due_date: "2026-10-20" }), ms({ id: "a", due_date: "2026-09-01", completed: true }), ms({ id: "c", due_date: "2026-09-22" })],
        [task({ id: "t1", milestone_id: "c", stage: "done" }), task({ id: "t2", milestone_id: "c" })],
        TODAY,
    );
    assert.deepEqual(stations.map((s) => [s.id, s.state, s.accepted, s.total]), [["a", "delivered", 0, 0], ["c", "late", 1, 2], ["b", "upcoming", 0, 0]]);
});

test("journey progress stays within 0..1 and interpolates by date", () => {
    const st = [{ due_date: "2026-09-01" }, { due_date: "2026-09-21" }, { due_date: "2026-09-27" }, { due_date: "2026-10-10" }, { due_date: "2026-11-01" }];
    assert.equal(journeyProgress([], TODAY), 0);
    assert.equal(journeyProgress([{ due_date: "2026-10-01" }], TODAY), 0);
    assert.equal(journeyProgress([{ due_date: "2026-09-01" }], TODAY), 1);
    assert.equal(journeyProgress(st, "2026-08-01"), 0);
    assert.equal(journeyProgress(st, "2026-12-01"), 1);
    assert.equal(journeyProgress(st, "2026-09-27"), 0.5);
    assert.equal(journeyProgress(st, TODAY), (1 + 3 / 6) / 4);
});

test("needs: review summary names the oldest submission", () => {
    const needs = projectNeeds([], [task({ id: "new", stage: "review", updated_at: "2026-09-23T00:00:00Z" }), task({ id: "old", stage: "review", updated_at: "2026-09-21T00:00:00Z" })], TODAY);
    assert.equal(needs.review.count, 2);
    assert.equal(needs.review.oldest.id, "old");
    assert.equal(needs.count, 1);
});

test("needs: an overdue task already in review is counted once, under review", () => {
    const needs = projectNeeds([], [task({ id: "t", stage: "review", due_date: "2026-09-20" })], TODAY);
    assert.equal(needs.lateTasks.length, 0);
    assert.equal(needs.count, 1);
});

test("needs: late milestones carry days late and linked progress; coming up covers 7 days", () => {
    const needs = projectNeeds(
        [ms({ id: "m", due_date: "2026-09-22" }), ms({ id: "soon", due_date: "2026-09-28" }), ms({ id: "far", due_date: "2026-10-10" })],
        [task({ id: "a", milestone_id: "m", stage: "done" }), task({ id: "b", milestone_id: "m" }), task({ id: "late", due_date: "2026-09-23", assigned_to: "u1" }), task({ id: "rev", stage: "review", due_date: "2026-09-25" })],
        TODAY,
    );
    assert.deepEqual(needs.lateMilestones.map((m) => [m.id, m.daysLate, m.accepted, m.total]), [["m", 2, 1, 2]]);
    assert.deepEqual(needs.lateTasks.map((t) => [t.id, t.daysLate, t.assigned_to]), [["late", 1, "u1"]]);
    assert.deepEqual(needs.comingUp.map((d) => d.id), ["soon"]);
    assert.equal(needs.count, 3);
});

test("quick picks: tomorrow, 3 days, next Monday, a week", () => {
    assert.deepEqual(quickPickDates(TODAY).map((p) => p.date), ["2026-09-25", "2026-09-27", "2026-09-28", "2026-10-01"]);
    assert.equal(quickPickDates("2026-09-28")[2].date, "2026-10-05");
});

test("calendar phrase before, during and after the project", () => {
    assert.equal(calendarPhrase("2026-10-01", "2026-12-01", TODAY), "Starts in 7 days");
    assert.equal(calendarPhrase("2026-09-01", "2026-09-25", TODAY), "1 day left");
    assert.equal(calendarPhrase("2026-08-01", "2026-09-20", TODAY), "4 days past its end");
});

test("stage: a failed task load is unavailable, never mistaken for a new project", () => {
    assert.equal(projectStage("in_progress", [ms({ id: "m", due_date: TODAY })], [], true), "unavailable");
    assert.equal(projectStage("completed", [], [], true), "closed");
});
