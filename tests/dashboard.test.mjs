import { test } from "node:test";
import assert from "node:assert/strict";
import {
    daysBetween,
    openDeadlines,
    partitionDeadlines,
    portfolioStages,
    projectLoads,
    isoDateIn,
    sortByAttention,
} from "../lib/dashboard.ts";

const TODAY = "2026-10-04";

const task = (over) => ({
    id: over.id,
    title: over.title ?? over.id,
    project_id: over.project_id ?? "p1",
    stage: over.stage ?? "to_do",
    due_date: over.due_date ?? null,
    client_visible_at: over.client_visible_at ?? null,
    updated_at: over.updated_at ?? "2026-10-01T00:00:00Z",
});
const milestone = (over) => ({
    id: over.id,
    title: over.title ?? over.id,
    project_id: over.project_id ?? "p1",
    due_date: over.due_date,
    completed: over.completed ?? false,
});

test("daysBetween counts whole calendar days across month ends", () => {
    assert.equal(daysBetween("2026-09-28", TODAY), 6);
    assert.equal(daysBetween(TODAY, TODAY), 0);
    assert.equal(daysBetween("2026-10-05", TODAY), -1);
});

test("open deadlines skip accepted tasks, delivered milestones and undated work", () => {
    const deadlines = openDeadlines([
        task({ id: "t-open", due_date: "2026-10-10" }),
        task({ id: "t-done", stage: "done", due_date: "2026-09-01" }),
        task({ id: "t-undated" }),
    ], [
        milestone({ id: "m-open", due_date: "2026-09-30" }),
        milestone({ id: "m-done", due_date: "2026-09-01", completed: true }),
    ]);
    assert.deepEqual(deadlines.map((d) => [d.kind, d.id]), [
        ["milestone", "m-open"],
        ["task", "t-open"],
    ]);
});

test("deadlines split into overdue (oldest first) and upcoming within the horizon", () => {
    const deadlines = openDeadlines([
        task({ id: "late", due_date: "2026-09-01" }),
        task({ id: "today", due_date: TODAY }),
        task({ id: "soon", due_date: "2026-10-18" }),
        task({ id: "later", due_date: "2026-10-19" }),
    ], [milestone({ id: "very-late", due_date: "2026-05-31" })]);
    const { overdue, upcoming } = partitionDeadlines(deadlines, TODAY, 14);
    assert.deepEqual(overdue.map((d) => d.id), ["very-late", "late"]);
    assert.deepEqual(upcoming.map((d) => d.id), ["today", "soon"]);
});

test("project loads count tasks by board stage, review work and overdue items", () => {
    const loads = projectLoads(["p1", "p2"], [
        task({ id: "a", stage: "done" }),
        task({ id: "b", stage: "review", due_date: "2026-09-01" }),
        task({ id: "c", stage: "in_progress", due_date: "2026-10-20" }),
        task({ id: "d", stage: "backlog" }),
    ], [milestone({ id: "m", due_date: "2026-09-15" })], TODAY);
    const p1 = loads.get("p1");
    assert.equal(p1.tasksTotal, 4);
    assert.deepEqual(p1.stages, { to_do: 1, in_progress: 1, review: 1, done: 1 }, "backlog counts as To do, as on the board");
    assert.deepEqual(p1.inReview.map((t) => t.id), ["b"]);
    assert.equal(p1.overdue, 2, "a submitted task past its date and a late milestone are both overdue");
    assert.equal(p1.nextDeadline.id, "b", "the earliest open deadline, even when it is already late");
    assert.deepEqual(loads.get("p2"), { tasksTotal: 0, stages: { to_do: 0, in_progress: 0, review: 0, done: 0 }, inReview: [], overdue: 0, nextDeadline: null });
});

test("most urgent projects come first: overdue, then review, then nearest end date", () => {
    const projects = [
        { id: "quiet-soon", end_date: "2026-10-10" },
        { id: "late-work", end_date: "2026-12-01" },
        { id: "review", end_date: "2026-11-01" },
        { id: "quiet-later", end_date: "2026-11-20" },
    ];
    const loads = projectLoads(projects.map((p) => p.id), [
        task({ id: "r", project_id: "review", stage: "review", due_date: "2026-10-30" }),
        task({ id: "l", project_id: "late-work", due_date: "2026-09-01" }),
    ], [], TODAY);
    assert.deepEqual(sortByAttention(projects, loads).map((p) => p.id), [
        "late-work",
        "review",
        "quiet-soon",
        "quiet-later",
    ]);
});

test("today is the Manila calendar date, not the UTC one", () => {
    // 23:30 UTC on Oct 3 is already 07:30 on Oct 4 in Manila.
    assert.equal(isoDateIn("2026-10-03T23:30:00Z"), "2026-10-04");
    assert.equal(isoDateIn("2026-10-04T15:59:00Z"), "2026-10-04");
    assert.equal(isoDateIn("2026-10-04T16:00:00Z"), "2026-10-05");
});

test("portfolio stages add every project's board stages together", () => {
    const loads = projectLoads(["p1", "p2"], [
        task({ id: "a", project_id: "p1", stage: "done" }),
        task({ id: "b", project_id: "p1", stage: "backlog" }),
        task({ id: "c", project_id: "p2", stage: "review" }),
    ], [], TODAY);
    assert.deepEqual(portfolioStages(loads.values()), { to_do: 1, in_progress: 0, review: 1, done: 1, total: 3 });
});

test("overview wording helpers", async () => {
    const { plural, relativeDay, duePhrase, relativePast, spanShare, greeting } = await import("../lib/dashboard.ts");
    assert.equal(plural(1, "task"), "1 task");
    assert.equal(plural(3, "task"), "3 tasks");
    assert.equal(relativeDay(TODAY, TODAY), "Today");
    assert.equal(relativeDay("2026-10-05", TODAY), "Tomorrow");
    assert.equal(relativeDay("2026-10-07", TODAY), "Wed, Oct 7");
    assert.equal(duePhrase("2026-10-09", TODAY), "Oct 9");
    assert.equal(relativePast("2026-10-01", TODAY), "3d ago");
    assert.equal(spanShare("2026-10-01", "2026-10-11", "2026-10-06"), 0.5);
    assert.equal(spanShare("2026-10-01", "2026-10-11", "2026-09-01"), 0);
    assert.equal(spanShare("2026-10-01", "2026-10-11", "2027-01-01"), 1);
    // Manila is UTC+8 with no daylight saving.
    assert.equal(greeting(new Date("2026-10-04T01:00:00Z")), "Good morning");
    assert.equal(greeting(new Date("2026-10-04T05:00:00Z")), "Good afternoon");
    assert.equal(greeting(new Date("2026-10-04T11:00:00Z")), "Good evening");
});

test("ISO week numbers and project pace", async () => {
    const { isoWeek, projectPace } = await import("../lib/dashboard.ts");
    assert.equal(isoWeek("2026-10-05"), 41);
    assert.equal(isoWeek("2026-01-01"), 1);
    assert.equal(isoWeek("2027-01-01"), 53);
    const span = { start_date: "2026-10-01", end_date: "2026-10-11" };
    const load = (done, total) => ({ tasksTotal: total, stages: { to_do: total - done, in_progress: 0, review: 0, done } });
    assert.equal(projectPace(span, load(1, 10), "2026-10-09").state, "behind");
    assert.equal(projectPace(span, load(5, 10), "2026-10-06").state, "on_pace");
    assert.equal(projectPace(span, load(0, 0), "2026-09-20").state, "not_started");
    assert.equal(projectPace(span, load(9, 10), "2026-10-20").state, "ended");
});

test("deadlines group by project, oldest first, projects by their oldest", async () => {
    const { groupByProject } = await import("../lib/dashboard.ts");
    const d = (id, project_id, due_date) => ({ kind: "task", id, project_id, title: id, due_date });
    const groups = groupByProject([d("a", "p2", "2026-09-10"), d("b", "p1", "2026-09-20"), d("c", "p2", "2026-09-01"), d("e", "p1", "2026-09-05")]);
    assert.deepEqual(groups.map((g) => g.map((x) => x.id)), [["c", "a"], ["e", "b"]]);
});

test("an opening card grows evenly to its ratio, or as far as both sides allow", async () => {
    const { centredGrowth } = await import("../lib/dashboard.ts");
    // Plenty of room: (200 + 2g) * 1.25 = 1.5 * 200, so g = 20.
    assert.ok(Math.abs(centredGrowth(400, 600, 0, 1000, 1.5, 1.25) - 20) < 1e-9);
    // Near the left edge: limited so the zoomed card stops exactly at min on both sides.
    const g = centredGrowth(100, 300, 60, 1000, 1.5, 1.25);
    assert.ok(g > 0 && g < 20);
    assert.ok(Math.abs(200 - ((200 + 2 * g) * 1.25) / 2 - 60) < 1e-9);
    // No room at all: never shrinks below its slot.
    assert.equal(centredGrowth(0, 200, 0, 200, 1.5, 1.25), 0);
});

test("field order puts sent-back work first, then underway, ready, and waiting", async () => {
    const { fieldOrder } = await import("../lib/dashboard.ts");
    const t = (id, stage, due_date = null) => ({ id, stage, due_date });
    const order = fieldOrder([t("review", "review", "2026-10-01"), t("todo-late", "to_do", "2026-10-02"), t("todo", "to_do", "2026-10-09"), t("prog", "in_progress", "2026-10-20"), t("prog-nodate", "in_progress"), t("back", "in_progress", "2026-10-30")], new Set(["back"]));
    assert.deepEqual(order.map((x) => x.id), ["back", "prog", "prog-nodate", "todo-late", "todo", "review"]);
});

test("ago phrases use full words, then the date", async () => {
    const { agoPhrase } = await import("../lib/dashboard.ts");
    assert.equal(agoPhrase("2026-10-04", "2026-10-04"), "today");
    assert.equal(agoPhrase("2026-10-03", "2026-10-04"), "yesterday");
    assert.equal(agoPhrase("2026-09-29", "2026-10-04"), "5 days ago");
    assert.equal(agoPhrase("2026-06-08", "2026-10-04"), "on Jun 8");
});

test("a quiet week names what comes next, else the projects whose plan ran out, else nothing", async () => {
    const { quietWeek } = await import("../lib/dashboard.ts");
    const d = (id, project_id, due_date) => ({ kind: "task", id, project_id, title: id, due_date });
    const later = d("next", "p1", "2026-10-30");
    assert.deepEqual(quietWeek([d("late", "p1", "2026-09-01")], later), { kind: "next", deadline: later });
    assert.deepEqual(quietWeek([d("a", "p1", "2026-09-01"), d("b", "p2", "2026-09-02"), d("c", "p1", "2026-09-03")], undefined), {
        kind: "stalled",
        projects: [{ project_id: "p1", late: 2 }, { project_id: "p2", late: 1 }],
    });
    assert.deepEqual(quietWeek([], undefined), { kind: "idle" });
});
