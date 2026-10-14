import { test } from "node:test";
import assert from "node:assert/strict";
import { clientHealth, clientStage, groupUpdates, newSince, nextMilestoneSentence, photoCaption, readVisitBaseline, sinceLabel, toClientPhotos } from "../lib/client-project.ts";

const TODAY = "2026-09-24"; // a Thursday
const ms = (o) => ({ id: o.id, title: o.title ?? o.id, project_id: "p1", due_date: o.due_date, completed: o.completed ?? false });

test("stage: closed, planning while invites or planning, delivered when every milestone is, else running", () => {
    assert.equal(clientStage("completed", []), "closed");
    assert.equal(clientStage("pending_invites", [ms({ id: "a", due_date: TODAY, completed: true })]), "planning");
    assert.equal(clientStage("planning", []), "planning");
    assert.equal(clientStage("in_progress", [ms({ id: "a", due_date: TODAY, completed: true })]), "delivered");
    assert.equal(clientStage("in_progress", []), "running");
    assert.equal(clientStage("on_hold", [ms({ id: "a", due_date: TODAY })]), "running");
});

test("health names the earliest late milestone", () => {
    const milestones = [ms({ id: "c", due_date: "2026-10-10" }), ms({ id: "a", title: "Fit-out", due_date: "2026-09-20" }), ms({ id: "b", due_date: "2026-09-10", completed: true })];
    assert.deepEqual(clientHealth("in_progress", milestones, TODAY), { text: "Fit-out 4 days late", tone: "late" });
    assert.deepEqual(clientHealth("in_progress", [milestones[0]], TODAY), { text: "On track", tone: "steady" });
    assert.deepEqual(clientHealth("completed", milestones, TODAY), { text: "Completed", tone: "done" });
});

test("next milestone sentence: late, today, tomorrow, later, none", () => {
    assert.deepEqual(nextMilestoneSentence([ms({ id: "a", title: "Fit-out", due_date: "2026-09-20" })], TODAY), { text: "Fit-out was due Sep 20 · 4 days past its date", late: true });
    assert.deepEqual(nextMilestoneSentence([ms({ id: "a", title: "Fit-out", due_date: TODAY })], TODAY), { text: "Next: Fit-out, due today", late: false });
    assert.deepEqual(nextMilestoneSentence([ms({ id: "a", title: "Fit-out", due_date: "2026-09-25" })], TODAY), { text: "Next: Fit-out, due tomorrow", late: false });
    assert.deepEqual(nextMilestoneSentence([ms({ id: "a", title: "Fit-out", due_date: "2026-10-06" })], TODAY), { text: "Next: Fit-out, due Oct 6 · in 12 days", late: false });
    assert.equal(nextMilestoneSentence([ms({ id: "a", due_date: TODAY, completed: true })], TODAY), null);
    assert.equal(nextMilestoneSentence([], TODAY), null);
});

test("updates group by milestone, groups ordered by their newest entry, unlinked work under Other work", () => {
    const milestones = [{ id: "m1", title: "Design" }, { id: "m2", title: "Fit-out" }];
    const updates = [
        { id: "u1", milestone_id: "m1", at: "2026-09-20T02:00:00+00:00" },
        { id: "u2", milestone_id: null, at: "2026-09-22T02:00:00+00:00" },
        { id: "u3", milestone_id: "m1", at: "2026-09-23T02:00:00+00:00" },
        { id: "u4", milestone_id: "m2", at: "2026-09-21T02:00:00+00:00" },
    ];
    const groups = groupUpdates(updates, milestones);
    assert.deepEqual(groups.map((g) => [g.key, g.title, g.items.map((u) => u.id)]), [
        ["m1", "Design", ["u3", "u1"]],
        ["other", "Other work", ["u2"]],
        ["m2", "Fit-out", ["u4"]],
    ]);
});

test("new since compares instants, not strings; no baseline means nothing is new", () => {
    const items = [{ at: "2026-09-22T10:00:00+00:00" }, { at: "2026-09-20T10:00:00+00:00" }];
    assert.deepEqual(newSince(items, "2026-09-21T00:00:00.000Z"), [items[0]]);
    assert.deepEqual(newSince(items, null), []);
});

test("since label reads naturally in Manila", () => {
    assert.equal(sinceLabel("2026-09-24T01:00:00.000Z", TODAY), "since earlier today");
    assert.equal(sinceLabel("2026-09-23T01:00:00.000Z", TODAY), "since yesterday");
    assert.equal(sinceLabel("2026-09-22T01:00:00.000Z", TODAY), "since Tuesday");
    assert.equal(sinceLabel("2026-09-10T01:00:00.000Z", TODAY), "since Sep 10");
});

test("photo caption: work, milestone when there is one, approval date", () => {
    assert.equal(photoCaption("Kitchen cabinets", "Fit-out", "2026-09-20T02:00:00+00:00"), "Kitchen cabinets · Fit-out · approved Sep 20");
    assert.equal(photoCaption("Touch-up", null, "2026-09-20T02:00:00+00:00"), "Touch-up · approved Sep 20");
});

test("client photos: approved photos only, never files, videos or unapproved rows", () => {
    const row = (o) => ({ id: o.id, task_id: "t1", storage_path: `p/${o.id}`, media_kind: o.kind ?? "photo", approved_for_client_at: "approved" in o ? o.approved : "2026-09-20T02:00:00+00:00", task: { title: "Cabinets", milestone_id: "m1" } });
    const rows = [row({ id: "ok" }), row({ id: "unapproved", approved: null }), row({ id: "video", kind: "video" }), row({ id: "file", kind: "file" })];
    assert.deepEqual(toClientPhotos(rows, (p) => `https://x/${p}`), [
        { id: "ok", url: "https://x/p/ok", task_id: "t1", taskTitle: "Cabinets", milestone_id: "m1", at: "2026-09-20T02:00:00+00:00" },
    ]);
});

test("visit baseline: first visit is null and records now; later reads in the session keep the earlier visit; blocked storage is null", () => {
    const store = () => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, v) }; };
    const local = store();
    const s1 = store();
    assert.equal(readVisitBaseline("p1", s1, local, "2026-09-20T00:00:00.000Z"), null);
    assert.equal(readVisitBaseline("p1", s1, local, "2026-09-20T05:00:00.000Z"), null);
    const s2 = store();
    assert.equal(readVisitBaseline("p1", s2, local, "2026-09-24T00:00:00.000Z"), "2026-09-20T00:00:00.000Z");
    assert.equal(readVisitBaseline("p1", s2, local, "2026-09-24T09:00:00.000Z"), "2026-09-20T00:00:00.000Z");
    const blocked = { getItem: () => { throw new Error("blocked"); }, setItem: () => { throw new Error("blocked"); } };
    assert.equal(readVisitBaseline("p1", blocked, blocked, "2026-09-24T00:00:00.000Z"), null);
});
