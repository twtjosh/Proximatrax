import { test } from "node:test";
import assert from "node:assert/strict";
import { crewHealth, crewLanes, crewStage, milestoneFeed, myShare, nextMove, openWork, photoStatus, siteNext } from "../lib/crew-project.ts";

const TODAY = "2026-09-24"; // a Thursday
const ME = "me";
const task = (o) => ({
    id: o.id, stage: o.stage ?? "to_do", due_date: o.due_date ?? null,
    assigned_to: "assigned_to" in o ? o.assigned_to : ME, milestone_id: o.milestone_id ?? null,
});
const ms = (o) => ({ id: o.id, title: o.title ?? o.id, project_id: "p1", due_date: o.due_date, completed: o.completed ?? false });

test("stage: closed first, then unavailable, paused, idle, running", () => {
    assert.equal(crewStage("completed", 0, 0, true), "closed");
    assert.equal(crewStage("in_progress", 3, 0, true), "unavailable");
    assert.equal(crewStage("on_hold", 3, 0), "paused");
    assert.equal(crewStage("in_progress", 0, 0), "idle");
    assert.equal(crewStage("planning", 0, 2), "running");
});

test("lanes: only the viewer's tasks, sent back split from in progress, backlog is to do, soonest first", () => {
    const tasks = [
        task({ id: "a", stage: "in_progress", due_date: "2026-09-30" }),
        task({ id: "b", stage: "in_progress", due_date: "2026-09-25" }),
        task({ id: "c", stage: "backlog" }),
        task({ id: "d", stage: "review" }),
        task({ id: "e", stage: "done" }),
        task({ id: "x", stage: "to_do", assigned_to: "someone" }),
    ];
    const lanes = crewLanes(tasks, ME, new Set(["a"]));
    assert.deepEqual(lanes.sentBack.map((t) => t.id), ["a"]);
    assert.deepEqual(lanes.inProgress.map((t) => t.id), ["b"]);
    assert.deepEqual(lanes.toDo.map((t) => t.id), ["c"]);
    assert.deepEqual(lanes.review.map((t) => t.id), ["d"]);
    assert.deepEqual(lanes.accepted.map((t) => t.id), ["e"]);
});

test("next move: sent back beats overdue beats in progress beats to do; review and done never", () => {
    const sent = new Set(["s"]);
    const base = [
        task({ id: "r", stage: "review", due_date: "2026-09-01" }),
        task({ id: "t", stage: "to_do", due_date: "2026-09-25" }),
        task({ id: "p", stage: "in_progress", due_date: "2026-10-10" }),
    ];
    const overdue = task({ id: "o", stage: "to_do", due_date: "2026-09-20" });
    assert.equal(nextMove(base, ME, sent, TODAY).id, "p");
    assert.equal(nextMove([...base, overdue], ME, sent, TODAY).id, "o");
    assert.equal(nextMove([...base, overdue, task({ id: "s", stage: "in_progress" })], ME, sent, TODAY).id, "s");
    assert.equal(nextMove([task({ id: "r", stage: "review" }), task({ id: "d", stage: "done" })], ME, sent, TODAY), null);
});

test("open work: unassigned to do only, soonest first, undated last", () => {
    const tasks = [
        task({ id: "u1", assigned_to: null }),
        task({ id: "u2", assigned_to: null, due_date: "2026-09-26" }),
        task({ id: "u3", assigned_to: null, stage: "in_progress" }),
        task({ id: "m", due_date: "2026-09-25" }),
    ];
    assert.deepEqual(openWork(tasks).map((t) => t.id), ["u2", "u1"]);
});

test("share and health: the viewer's work only; work in review is not the viewer's lateness", () => {
    const tasks = [
        task({ id: "a", stage: "done" }),
        task({ id: "b", stage: "review", due_date: "2026-09-01" }),
        task({ id: "c", stage: "to_do", due_date: "2026-09-23" }),
        task({ id: "x", stage: "to_do", due_date: "2026-09-01", assigned_to: "other" }),
    ];
    assert.deepEqual(myShare(tasks, ME), { accepted: 1, total: 3 });
    assert.deepEqual(crewHealth("in_progress", tasks, ME, TODAY), { text: "1 of yours overdue", tone: "late" });
    assert.deepEqual(crewHealth("in_progress", tasks.slice(0, 2), ME, TODAY), { text: "On track", tone: "steady" });
    assert.deepEqual(crewHealth("completed", tasks, ME, TODAY), { text: "Completed", tone: "done" });
});

test("milestone feed: date order, states, project progress and the viewer's tasks inside", () => {
    const milestones = [
        ms({ id: "m2", due_date: "2026-10-30" }),
        ms({ id: "m1", due_date: "2026-09-10", completed: true }),
        ms({ id: "m3", due_date: "2026-09-20" }),
        ms({ id: "m4", due_date: "2026-11-30" }),
    ];
    const tasks = [
        task({ id: "a", milestone_id: "m2", stage: "done" }),
        task({ id: "b", milestone_id: "m2", assigned_to: "other" }),
        task({ id: "c", milestone_id: "m3" }),
    ];
    const feed = milestoneFeed(milestones, tasks, ME, TODAY);
    assert.deepEqual(feed.map((f) => [f.id, f.state]), [["m1", "delivered"], ["m3", "late"], ["m2", "next"], ["m4", "upcoming"]]);
    assert.deepEqual([feed[2].accepted, feed[2].total, feed[2].mine.map((t) => t.id)], [1, 2, ["a"]]);
});

test("site next: first undelivered milestone with days left (negative when late); none when all delivered or none set", () => {
    const feed = milestoneFeed([ms({ id: "m3", due_date: "2026-09-20" }), ms({ id: "m1", due_date: "2026-09-10", completed: true })], [task({ id: "c", milestone_id: "m3" })], ME, TODAY);
    assert.deepEqual(siteNext(feed, TODAY), { title: "m3", due_date: "2026-09-20", days: -4, mine: 1 });
    assert.equal(siteNext(milestoneFeed([ms({ id: "m", due_date: TODAY, completed: true })], [], ME, TODAY), TODAY), null);
    assert.equal(siteNext([], TODAY), null);
});

test("photo status: approved is shown to the client, review is with the PM, else not shared", () => {
    assert.equal(photoStatus("2026-09-20T00:00:00Z", "done"), "shown");
    assert.equal(photoStatus(null, "review"), "with_pm");
    assert.equal(photoStatus(null, "in_progress"), "not_shared");
    assert.equal(photoStatus(null, undefined), "not_shared");
});
