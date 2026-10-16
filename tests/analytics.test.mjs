import { test } from "node:test";
import assert from "node:assert/strict";
import {
    agePhrase,
    ageTone,
    behindSchedule,
    crewRecord,
    deliveries,
    deliveryPhrase,
    deliveryRecord,
    inquiryYear,
    lastMonths,
    milestoneRecord,
    openLoad,
    overrun,
    overrunFact,
    projectResult,
    projectRows,
    resultPhrase,
    resultTone,
    reviewTurnaround,
    taskCounts,
    waitingForReview,
} from "../lib/analytics.ts";

const TODAY = "2026-10-15";
/** 02:00Z is 10:00 in Manila: the same calendar date. */
const at = (date, hour = 2) => `${date}T${String(hour).padStart(2, "0")}:00:00Z`;
const project = (o = {}) => ({ id: "p1", title: "Tagaytay Rest House", pm_id: "marco", client_id: "c1", status: "in_progress", start_date: "2026-06-15", end_date: "2026-10-30", completed_at: null, ...o });
const milestone = (o = {}) => ({ id: "m1", project_id: "p1", title: "Kitchen cabinets installed", due_date: "2026-10-09", completed: false, completed_at: null, ...o });
const done = (id, title, end, completed) => project({ id, title, status: "completed", end_date: end, completed_at: at(completed) });
const marco2026 = [
    done("mk", "Makati Studio", "2026-03-12", "2026-03-18"),
    done("ps", "Pasig Condo 12B", "2026-06-24", "2026-06-20"),
    done("mr", "Marikina Bungalow", "2026-09-12", "2026-09-22"),
    project({ id: "tg" }),
];

test("overrun: an overdue milestone beats an end date still ahead", () => {
    const o = overrun(project(), [milestone()], TODAY);
    assert.deepEqual([o.kind, o.days, o.milestone.title], ["milestone", 6, "Kitchen cabinets installed"]);
});

test("overrun: past the end date wins a tie and names the first open milestone", () => {
    const p = project({ id: "p2", end_date: "2026-10-10" });
    const o = overrun(p, [milestone({ id: "m2", project_id: "p2", title: "Final turnover", due_date: "2026-10-10" })], TODAY);
    assert.deepEqual([o.kind, o.days, o.milestone.title], ["end", 5, "Final turnover"]);
});

test("overrun: none for completed, on-schedule and not-yet-started projects", () => {
    assert.equal(overrun(done("x", "X", "2026-10-10", "2026-10-20"), [], TODAY), null);
    assert.equal(overrun(project(), [milestone({ completed: true, completed_at: at("2026-10-08") })], TODAY), null);
    assert.equal(overrun(project({ start_date: "2026-11-01", end_date: "2026-12-01" }), [], TODAY), null);
});

test("overrunFact: wording for a late milestone, an end date with an open milestone, and one without", () => {
    const p = project();
    assert.equal(overrunFact(overrun(p, [milestone()], TODAY), p), "Milestone “Kitchen cabinets installed” was due Oct 9");
    const q = project({ end_date: "2026-10-10" });
    assert.equal(overrunFact(overrun(q, [milestone({ due_date: "2026-10-20", title: "Final turnover" })], TODAY), q), "Passed its end date of Oct 10; “Final turnover” is still open");
    const r = project({ end_date: "2026-10-12" });
    const o = overrun(r, [], TODAY);
    assert.deepEqual([o.kind, o.days, o.milestone], ["end", 3, null]);
    assert.equal(overrunFact(o, r), "Passed its end date of Oct 12");
});

test("behindSchedule: only late active projects, most late first", () => {
    const list = behindSchedule([project({ id: "a", end_date: "2026-10-10" }), project({ id: "b" }), project({ id: "c", end_date: "2026-12-12" })], [milestone({ project_id: "b" })], TODAY);
    assert.deepEqual(list.map((x) => [x.project.id, x.days]), [["b", 6], ["a", 5]]);
});

test("projectResult: delivered late, early, on the day", () => {
    assert.deepEqual(projectResult(done("a", "A", "2026-09-12", "2026-09-22"), [], TODAY), { kind: "late", days: 10 });
    assert.deepEqual(projectResult(done("b", "B", "2026-06-24", "2026-06-20"), [], TODAY), { kind: "early", days: 4 });
    assert.deepEqual(projectResult(done("c", "C", "2026-06-24", "2026-06-24"), [], TODAY), { kind: "on_day", days: 0 });
});

test("projectResult: completion is dated in Manila, not UTC", () => {
    // 17:00Z on Sep 12 is 01:00 on Sep 13 in Manila: one day late.
    const p = project({ status: "completed", end_date: "2026-09-12", completed_at: "2026-09-12T17:00:00Z" });
    assert.deepEqual(projectResult(p, [], TODAY), { kind: "late", days: 1 });
});

test("projectResult: active projects", () => {
    assert.deepEqual(projectResult(project({ end_date: "2026-10-10" }), [], TODAY), { kind: "past_end", days: 5 });
    assert.deepEqual(projectResult(project(), [milestone()], TODAY), { kind: "milestone_late", days: 6 });
    assert.deepEqual(projectResult(project(), [], TODAY), { kind: "on_schedule", days: 0 });
});

test("resultPhrase and resultTone", () => {
    assert.equal(resultPhrase({ kind: "milestone_late", days: 6 }), "Milestone 6 days late");
    assert.equal(resultPhrase({ kind: "past_end", days: 1 }), "1 day past end date");
    assert.equal(resultPhrase({ kind: "late", days: 10 }), "10 days late");
    assert.equal(resultPhrase({ kind: "early", days: 4 }), "4 days early");
    assert.equal(resultPhrase({ kind: "on_day", days: 0 }), "On the day");
    assert.equal(resultPhrase({ kind: "on_schedule", days: 0 }), "On schedule");
    assert.equal(resultTone({ kind: "late", days: 2 }), "bad");
    assert.equal(resultTone({ kind: "milestone_late", days: 2 }), "bad");
    assert.equal(resultTone({ kind: "early", days: 2 }), "good");
    assert.equal(resultTone({ kind: "on_day", days: 0 }), "good");
    assert.equal(resultTone({ kind: "on_schedule", days: 0 }), "neutral");
});

test("deliveries: completed projects only, oldest first, with days past the planned end", () => {
    assert.deepEqual(deliveries(marco2026).map((d) => [d.project.id, d.date, d.late]), [["mk", "2026-03-18", 6], ["ps", "2026-06-20", -4], ["mr", "2026-09-22", 10]]);
});

test("deliveryRecord: on-time count and the average lateness of the late ones", () => {
    assert.deepEqual(deliveryRecord(deliveries(marco2026)), { delivered: 3, onTime: 1, avgLate: 8 });
    assert.deepEqual(deliveryRecord([]), { delivered: 0, onTime: 0, avgLate: null });
});

test("deliveryPhrase", () => {
    assert.equal(deliveryPhrase(10), "10 days late");
    assert.equal(deliveryPhrase(-1), "1 day early");
    assert.equal(deliveryPhrase(0), "on the day");
});

test("lastMonths: twelve months ending this month, oldest first", () => {
    const m = lastMonths(TODAY);
    assert.equal(m.length, 12);
    assert.deepEqual(m[0], { key: "2025-11", month: 10, year: 2025 });
    assert.deepEqual(m[2], { key: "2026-01", month: 0, year: 2026 });
    assert.equal(m[11].key, "2026-10");
});

test("inquiryYear: this year's inquiries, converted, and not yet opened by this viewer", () => {
    const rows = [
        { id: "1", status: "converted", created_at: at("2026-02-01") },
        { id: "2", status: "new", created_at: at("2026-09-01") },
        { id: "3", status: "contacted", created_at: at("2026-05-01") },
        { id: "4", status: "new", created_at: at("2025-12-30") },
    ];
    assert.deepEqual(inquiryYear(rows, ["1", "3"], "2026"), { received: 3, converted: 1, unopened: 1 });
});

const task = (o = {}) => ({ id: "t1", project_id: "p1", title: "Grout and seal backsplash", stage: "to_do", assigned_to: null, due_date: null, completed_at: null, updated_at: at("2026-10-01"), ...o });
const move = (task_id, from, to, when) => ({ task_id, from, to, at: when });

test("milestoneRecord: on time by Manila completion date; overdue counts open ones only", () => {
    const ms = [
        milestone({ id: "a", due_date: "2026-07-01", completed: true, completed_at: at("2026-06-30") }),
        milestone({ id: "b", due_date: "2026-08-01", completed: true, completed_at: at("2026-08-03") }),
        milestone({ id: "c", due_date: "2026-09-01", completed: true, completed_at: null }),
        milestone({ id: "d", due_date: "2026-10-09" }),
        milestone({ id: "e", due_date: "2026-11-01" }),
    ];
    assert.deepEqual(milestoneRecord(ms, TODAY), { completed: 3, onTime: 2, overdue: 1, ticks: ["on_time", "late", "on_time"] });
    assert.deepEqual(milestoneRecord([], TODAY), { completed: 0, onTime: 0, overdue: 0, ticks: [] });
});

test("taskCounts: ongoing, due from today through day 13, completed", () => {
    const ts = [
        task({ id: "1", stage: "in_progress" }),
        task({ id: "2", stage: "review" }),
        task({ id: "3", due_date: TODAY }),
        task({ id: "4", due_date: "2026-10-28" }),
        task({ id: "5", due_date: "2026-10-29" }),
        task({ id: "6", stage: "done", due_date: "2026-10-20" }),
        task({ id: "7", due_date: "2026-10-14" }),
    ];
    assert.deepEqual(taskCounts(ts, TODAY), { ongoing: 2, dueSoon: 2, completed: 1 });
});

test("openLoad: work in review is never late", () => {
    const ts = [task({ id: "1", due_date: "2026-10-01" }), task({ id: "2", stage: "review", due_date: "2026-10-01" }), task({ id: "3", stage: "done", due_date: "2026-10-01" }), task({ id: "4" })];
    assert.deepEqual(openLoad(ts, TODAY), { open: 3, late: 1, review: 1 });
});

test("waitingForReview: dated from the latest submission, else the last update; oldest first", () => {
    const ts = [task({ id: "a", stage: "review" }), task({ id: "b", stage: "review", updated_at: at("2026-10-12") }), task({ id: "c", stage: "in_progress" })];
    const moves = [
        move("a", "in_progress", "review", at("2026-10-05")),
        move("a", "review", "in_progress", at("2026-10-06")),
        move("a", "in_progress", "review", at("2026-10-10")),
        move("c", "in_progress", "review", at("2026-10-01")),
    ];
    assert.deepEqual(waitingForReview(ts, moves, TODAY).map((w) => [w.task.id, w.days]), [["a", 5], ["b", 3]]);
});

test("reviewTurnaround: mean days to an answer over the last 90 days, unanswered left out", () => {
    const moves = [
        move("a", "in_progress", "review", at("2026-10-01")), move("a", "review", "done", at("2026-10-03")),
        move("b", "in_progress", "review", at("2026-10-02")), move("b", "review", "in_progress", at("2026-10-05")),
        move("c", "in_progress", "review", at("2026-10-14")),
        move("d", "in_progress", "review", at("2026-06-01")), move("d", "review", "done", at("2026-06-11")),
    ];
    assert.equal(reviewTurnaround(moves, TODAY), 2.5);
    assert.equal(reviewTurnaround([], TODAY), null);
});

test("crewRecord: per current assignee, unassigned and idle ignored, most late first", () => {
    const people = [
        { id: "jessa", name: "Jessa Mendoza", avatarUrl: null },
        { id: "arnel", name: "Arnel Cruz", avatarUrl: null },
        { id: "idle", name: "Nobody Here", avatarUrl: null },
    ];
    const ts = [
        task({ id: "1", assigned_to: "arnel", due_date: "2026-10-01" }),
        task({ id: "2", assigned_to: "arnel", stage: "done", due_date: "2026-09-01", completed_at: at("2026-09-03") }),
        task({ id: "3", assigned_to: "jessa", stage: "done", completed_at: at("2026-09-03") }),
        task({ id: "4", assigned_to: "jessa", stage: "done", due_date: "2026-09-10", completed_at: at("2026-09-09") }),
        task({ id: "5", due_date: "2026-10-01" }),
    ];
    const moves = [
        move("2", "in_progress", "review", at("2026-08-30")),
        move("2", "review", "in_progress", at("2026-08-31")),
        move("2", "in_progress", "review", at("2026-09-02")),
        move("2", "review", "done", at("2026-09-03")),
        move("4", "in_progress", "review", at("2026-09-08")),
        move("5", "in_progress", "review", at("2026-09-08")),
    ];
    assert.deepEqual(
        crewRecord(people, ts, moves, TODAY).map((r) => [r.id, r.open, r.late, r.finished, r.finishedOnTime, r.sentBack, r.submissions]),
        [["arnel", 1, 1, 1, 0, 1, 2], ["jessa", 0, 0, 2, 2, 0, 1]],
    );
});

test("projectRows: active by newest start, delivered by newest delivery, with counts and result", () => {
    const ps = [project({ id: "old", start_date: "2026-01-01" }), project({ id: "new", start_date: "2026-09-28", end_date: "2026-12-12" }), ...marco2026.slice(0, 3)];
    const ms = [milestone({ id: "x", project_id: "old" }), milestone({ id: "y", project_id: "mr", due_date: "2026-09-01", completed: true, completed_at: at("2026-09-05") })];
    const ts = [task({ id: "1", project_id: "old", stage: "done" }), task({ id: "2", project_id: "old" })];
    const r = projectRows(ps, ms, ts, TODAY);
    assert.deepEqual(r.active.map((x) => x.project.id), ["new", "old"]);
    assert.deepEqual(r.delivered.map((x) => x.project.id), ["mr", "ps", "mk"]);
    assert.deepEqual(r.active[1].milestones, { done: 0, onTime: 0, overdue: 1 });
    assert.deepEqual(r.active[1].tasks, { done: 1, total: 2 });
    assert.equal(r.active[1].result.kind, "milestone_late");
    assert.deepEqual(r.delivered[0].milestones, { done: 1, onTime: 0, overdue: 0 });
});

test("agePhrase and ageTone", () => {
    assert.equal(agePhrase(0), "today");
    assert.equal(agePhrase(1), "1 day");
    assert.equal(agePhrase(5), "5 days");
    assert.equal(ageTone(1), "quiet");
    assert.equal(ageTone(2), "warn");
    assert.equal(ageTone(3), "late");
});
