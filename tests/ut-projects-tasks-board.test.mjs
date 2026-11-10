// UT-04 Projects, UT-05 Lifecycle, UT-06 Tasks, UT-07 Kanban, UT-08 Review.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { kase } from "./helpers/harness.mjs";

const { fakeSupabase, setFake, jsonRequest } = await import("./helpers/stubs.mjs");
const { createProject, updateProject, completeProject, reopenProject, removeProjectMember, seedDefaultMilestones, syncMilestoneFromLinkedTasks } = await import("@/services/project-service");
const { endDateError, missingPhrase, spanPhrase } = await import("@/lib/new-project");
const withInvitations = await import("@/app/api/projects/with-invitations/route");
const { templateMilestones, DEFAULT_LIFECYCLE_TEMPLATE } = await import("@/lib/milestone-template");
const { assessProjectClosureReadiness, splitProjectsByLifecycle, projectProgress } = await import("@/lib/project-lifecycle");
const gates = await import("@/lib/milestone-task-gates");
const { createTask, updateTask, claimOpenTask } = await import("@/services/task-service");
const { parseQuickAdd } = await import("@/lib/quick-add");
const board = await import("@/lib/board-workflow");
const flow = await import("@/lib/work-task-flow");
const { reviewQueue, sendBackChecklist } = await import("@/lib/review-queue");

const ORIGIN = "https://app.test";
const seq = (prefix) => {
    let n = 0;
    return () => `${prefix}.${String(++n).padStart(2, "0")}`;
};

// ─── UT-04 ──────────────────────────────────────────────────────────────────
const id4 = seq("UT-04");
const input = { title: "  Condo  ", description: "  ", client_id: "c", pm_id: "p", start_date: "2026-01-01", end_date: "2026-02-01" };
const created = (sb) => (setFake(sb), sb);

kase(id4(), "createProject", "An end before the start is refused before any write", "end one day before start", "Throws, no query", async () => {
    const sb = fakeSupabase();
    await assert.rejects(createProject({ ...input, end_date: "2025-12-31" }, sb), /on or after/);
    assert.equal(sb.calls.length, 0);
});
kase(id4(), "createProject", "A one-day project is valid", "start equals end", "Row inserted", async () => {
    const sb = fakeSupabase((q) => (q.op === "select" ? { data: { id: "x" }, error: null } : null));
    await createProject({ ...input, end_date: input.start_date }, sb);
    assert.equal(sb.calls[0].op, "insert");
});
kase(id4(), "createProject", "Title and description are normalized; default status is planning", "title '  Condo  ', blank description", "Condo, null, planning", async () => {
    const sb = fakeSupabase((q) => (q.op === "select" ? { data: { id: "x" }, error: null } : null));
    await createProject(input, sb);
    const row = sb.calls[0].payload;
    assert.deepEqual([row.title, row.description, row.status], ["Condo", null, "planning"]);
});
kase(id4(), "createProject", "A row the caller can't read back is reported, not assumed saved", "insert ok, select empty", "Throws", async () => {
    await assert.rejects(createProject(input, fakeSupabase()), /could not be loaded/);
});
kase(id4(), "updateProject", "Editing can't reverse the dates", "end before start", "Throws, no query", async () => {
    const sb = fakeSupabase();
    await assert.rejects(updateProject({ id: "1", start_date: "2026-02-01", end_date: "2026-01-01" }, sb), /on or after/);
    assert.equal(sb.calls.length, 0);
});
for (const [s, e, want] of [["2026-02-01", "2026-01-31", "The end date is before the start date. Pick Feb 1 or later."], ["2026-02-01", "2026-02-01", null], ["", "2026-02-01", null], ["2026-02-01", "", null]])
    kase(id4(), "endDateError", "The form's date check at the boundary", `${s || "(blank)"} to ${e || "(blank)"}`, String(want), () => assert.equal(endDateError(s, e), want));
for (const [s, e, want] of [["2026-01-01", "2026-01-01", "Same day"], ["2026-01-01", "2026-01-06", "5 days"], ["2026-01-01", "2026-01-08", "1 week"], ["2026-01-01", "2026-03-01", "8 weeks 3 days"], ["2024-02-28", "2024-03-01", "2 days"], ["2026-02-01", "2026-01-01", null]])
    kase(id4(), "spanPhrase", "Project span wording, including a leap day", `${s} to ${e}`, String(want), () => assert.equal(spanPhrase(s, e), want));
kase(id4(), "missingPhrase", "Names everything required that is missing", "empty draft", "Add a title, a client, a middleman, a start date and an end date", () => assert.equal(missingPhrase({ title: " ", clientId: "", middlemanId: "", startDate: "", endDate: "" }), "Add a title, a client, a middleman, a start date and an end date"));
kase(id4(), "missingPhrase", "A complete draft has nothing to say", "complete draft", "null", () => assert.equal(missingPhrase({ title: "x", clientId: "c", middlemanId: "m", startDate: "a", endDate: "b" }), null));

const route = withInvitations.POST;
const body = { title: "Condo", clientId: "c1", middlemanId: "m1", startDate: "2026-01-01", endDate: "2026-02-01" };
const send = (b) => route(jsonRequest(`${ORIGIN}/api`, b));
const ROLES = { caller: "project_manager", c1: "client", m1: "middleman" };
const asPm = (over = {}, onQuery) => fakeSupabase((q) => {
    if (q.table === "profiles" && q.one)
        return { data: { role: over.caller ?? "project_manager" }, error: null };
    if (q.table === "profiles")
        return { data: Object.entries({ ...ROLES, ...over.roles }).map(([id, role]) => ({ id, role })), error: null };
    return onQuery?.(q) ?? (q.table === "projects" && q.op === "select" ? { data: { id: "np", title: "Condo", start_date: "2026-01-01", end_date: "2026-02-01" }, error: null } : { data: [], error: null });
}, { userId: "caller" });

kase(id4(), "POST /api/projects/with-invitations", "An anonymous caller is refused", "no session", "401", async () => {
    created(fakeSupabase());
    assert.equal((await send(body)).status, 401);
});
for (const role of ["super_admin", "middleman", "client"])
    kase(id4(), "POST /api/projects/with-invitations", "Only a project manager opens projects this way", `caller ${role}`, "403", async () => {
        created(asPm({ caller: role }));
        assert.equal((await send(body)).status, 403);
    });
for (const [what, b] of [["no title", { ...body, title: "  " }], ["no client", { ...body, clientId: "" }], ["no middleman", { ...body, middlemanId: undefined }], ["no start", { ...body, startDate: "" }], ["same person twice", { ...body, middlemanId: "c1" }], ["numeric title (regression D-12)", { ...body, title: 42 }], ["JSON null body (regression D-12)", "null"], ["malformed JSON", "{oops"]])
    kase(id4(), "POST /api/projects/with-invitations", "Bad input is refused and creates nothing", what, "400, no insert", async () => {
        const sb = created(asPm());
        assert.equal((await send(b)).status, 400);
        assert.equal(sb.calls.filter((c) => c.op === "insert").length, 0);
    });
for (const [what, roles] of [["client id is a middleman", { c1: "middleman" }], ["middleman id is a client", { m1: "client" }], ["client id is the super admin", { c1: "super_admin" }], ["client id matches no account", { c1: undefined }]])
    kase(id4(), "POST /api/projects/with-invitations", "Regression D-11: invitees must hold the role they are invited as", what, "400, no insert", async () => {
        const sb = created(asPm({ roles }));
        const res = await send(body);
        assert.equal(res.status, 400);
        assert.equal(sb.calls.filter((c) => c.op === "insert").length, 0);
    });
kase(id4(), "POST /api/projects/with-invitations", "A valid request opens the project waiting on invitations and seeds five phases", "valid body", "200, status pending_invites, 2 invitations, 5 milestones", async () => {
    const sb = created(asPm());
    assert.equal((await send(body)).status, 200);
    const inserts = (t) => sb.calls.find((c) => c.table === t && c.op === "insert").payload;
    assert.equal(inserts("projects").status, "pending_invites");
    assert.deepEqual(inserts("project_invitations").map((i) => i.invitee_role), ["client", "middleman"]);
    assert.equal(inserts("milestones").length, 5);
});
kase(id4(), "POST /api/projects/with-invitations", "A failed invitation removes the half-made project", "invitation insert fails", "400, project deleted", async () => {
    const sb = created(asPm({}, (q) => (q.table === "project_invitations" ? { data: null, error: { message: "denied" } } : null)));
    assert.equal((await send(body)).status, 400);
    assert.ok(sb.calls.some((c) => c.table === "projects" && c.op === "delete"));
});

// ─── UT-05 ──────────────────────────────────────────────────────────────────
const id5 = seq("UT-05");
kase(id5(), "DEFAULT_LIFECYCLE_TEMPLATE", "Records the lifecycle the code really seeds", "the template", "Site Survey, Design Approval, Site Preparation, Construction, Handover", () => assert.deepEqual([...DEFAULT_LIFECYCLE_TEMPLATE], ["Site Survey", "Design Approval", "Site Preparation", "Construction", "Handover"]));
kase(id5(), "templateMilestones", "Five phases evenly spaced, the last on the end date", "2026-01-01 to 2026-05-31", "Ascending, last due 2026-05-31", () => {
    const m = templateMilestones("2026-01-01", "2026-05-31");
    assert.equal(m.length, 5);
    assert.deepEqual(m.map((x) => x.due_date), [...m.map((x) => x.due_date)].sort());
    assert.equal(m[4].due_date, "2026-05-31");
});
kase(id5(), "templateMilestones", "A one-day project still gets every phase", "start equals end", "All five due that day", () => assert.ok(templateMilestones("2026-03-01", "2026-03-01").every((m) => m.due_date === "2026-03-01")));
for (const [s, e] of [["2026-02-01", "2026-01-01"], ["", "2026-01-01"], ["2026-01-01", ""], ["garbage", "2026-01-01"]])
    kase(id5(), "templateMilestones", "An invalid range seeds nothing", `${s || "(blank)"} to ${e || "(blank)"}`, "null", () => assert.equal(templateMilestones(s, e), null));
kase(id5(), "templateMilestones", "Dates don't depend on the machine's time zone", "same range under TZ America/New_York and Asia/Manila", "Identical due dates", () => {
    const saved = process.env.TZ;
    process.env.TZ = "America/New_York";
    const a = templateMilestones("2026-03-01", "2026-03-31");
    process.env.TZ = "Asia/Manila";
    const b = templateMilestones("2026-03-01", "2026-03-31");
    process.env.TZ = saved;
    assert.deepEqual(a, b);
});
kase(id5(), "seedDefaultMilestones", "A bad range is refused before the database", "reversed range", "Throws, no query", async () => {
    const sb = fakeSupabase();
    await assert.rejects(seedDefaultMilestones("p", "2026-02-01", "2026-01-01", sb), /invalid project date range/);
    assert.equal(sb.calls.length, 0);
});
const M = (completed) => ({ completed }), T = (stage) => ({ stage });
for (const [what, status, ms, ts, ready] of [["all delivered and accepted", "in_progress", [M(true)], [T("done")], true], ["no tasks at all, phases delivered", "in_progress", [M(true)], [], true], ["no phases", "in_progress", [], [T("done")], false], ["one phase open", "in_progress", [M(true), M(false)], [T("done")], false], ["one task in review", "in_progress", [M(true)], [T("done"), T("review")], false], ["already closed", "completed", [M(true)], [T("done")], false]])
    kase(id5(), "assessProjectClosureReadiness", "Handover needs every phase delivered and task accepted", what, `ready: ${ready}`, () => assert.equal(assessProjectClosureReadiness({ status }, ms, ts).ready, ready));
kase(id5(), "assessProjectClosureReadiness", "Blockers count what is left", "1 of 3 phases open, 2 of 3 tasks open", "'1 phase(s)' and '2 task(s)'", () => assert.deepEqual(assessProjectClosureReadiness({ status: "in_progress" }, [M(true), M(true), M(false)], [T("done"), T("to_do"), T("review")]).blockers, ["1 phase(s) are not yet delivered.", "2 task(s) are not yet in Accepted."]));
kase(id5(), "splitProjectsByLifecycle", "Only completed projects are archived", "planning, on_hold, completed", "2 active, 1 completed", () => {
    const r = splitProjectsByLifecycle([{ status: "planning" }, { status: "on_hold" }, { status: "completed" }]);
    assert.deepEqual([r.active.length, r.completed.length], [2, 1]);
});
kase(id5(), "projectProgress", "Regression D-22: phase rows count delivered phases", "client: 1 of 2 phases delivered", "1 of 2, not 100%", () => assert.deepEqual(projectProgress([{ project_id: "p", completed: true }, { project_id: "p", completed: false }]), { p: { total: 2, done: 1 } }));
kase(id5(), "projectProgress", "Task rows count accepted tasks", "PM: done and review", "1 of 2", () => assert.deepEqual(projectProgress([{ project_id: "p", stage: "done" }, { project_id: "p", stage: "review" }]), { p: { total: 2, done: 1 } }));
kase(id5(), "ProjectsPage", "Regression D-22: a client's card isn't computed from filtered tasks", "source of projects/page.tsx", "Clients read milestones", () => assert.match(readFileSync("app/(dashboard)/projects/page.tsx", "utf8"), /role === "client"\s*\? \(await supabase\.from\("milestones"\)/));
const ms = [{ id: "b", due_date: "2026-03-01", title: "B", completed: false }, { id: "a", due_date: "2026-02-01", title: "A", completed: false }];
const tk = (id, milestone_id, stage) => ({ id, milestone_id, stage });
kase(id5(), "sortMilestonesByPhase", "Phases run in due-date order, not insertion order", "B (March), A (February)", "A, B", () => assert.deepEqual(gates.sortMilestonesByPhase(ms).map((m) => m.id), ["a", "b"]));
kase(id5(), "priorPhasesBlockingTask", "Later work waits on an unfinished earlier phase", "task in B, A has an open task", "Blocked by A", () => {
    const r = gates.priorPhasesBlockingTask(tk("t", "b", "to_do"), [tk("x", "a", "review"), tk("t", "b", "to_do")], ms);
    assert.equal(r.blocked, true);
    assert.equal(r.milestone.id, "a");
});
kase(id5(), "priorPhasesBlockingTask", "An earlier phase with no tasks doesn't block", "task in B, A empty", "Not blocked", () => assert.equal(gates.priorPhasesBlockingTask(tk("t", "b", "to_do"), [tk("t", "b", "to_do")], ms).blocked, false));
kase(id5(), "priorPhasesBlockingTask", "The first phase never waits", "task in A", "Not blocked", () => assert.equal(gates.priorPhasesBlockingTask(tk("t", "a", "to_do"), [tk("t", "a", "to_do")], ms).blocked, false));
kase(id5(), "shouldAutoCompleteMilestone", "A phase with no tasks is never auto-delivered", "no linked tasks", "false", () => assert.equal(gates.shouldAutoCompleteMilestone("a", []), false));
kase(id5(), "shouldAutoCompleteMilestone", "A phase is delivered once every task is accepted", "2 of 2 done", "true", () => assert.equal(gates.shouldAutoCompleteMilestone("a", [tk("1", "a", "done"), tk("2", "a", "done")]), true));
kase(id5(), "shouldAutoReopenMilestone", "A delivered phase reopens when a task leaves Accepted", "1 done, 1 in_progress", "true", () => assert.equal(gates.shouldAutoReopenMilestone("a", [tk("1", "a", "done"), tk("2", "a", "in_progress")]), true));
kase(id5(), "syncMilestoneFromLinkedTasks", "Accepting the last task delivers the phase once", "all done, milestone open", "completed: true", async () => {
    const sb = fakeSupabase((q) => {
        if (q.table === "tasks")
            return { data: [tk("1", "a", "done")], error: null };
        if (q.table === "milestones" && q.op === "select")
            return { data: { id: "a", title: "A", completed: false, project_id: "p" }, error: null };
        if (q.table === "milestones")
            return { data: { id: "a", title: "A", completed: true }, error: null };
        if (q.table === "projects")
            return { data: { status: "in_progress", client_id: "c", title: "T" }, error: null };
        return null;
    }, { userId: "pm" });
    assert.deepEqual(await syncMilestoneFromLinkedTasks("p", "a", sb), { completed: true, reopened: false, title: "A" });
    assert.equal(sb.calls.filter((c) => c.table === "milestones" && c.op === "update").length, 1);
});
kase(id5(), "syncMilestoneFromLinkedTasks", "A delivered phase isn't delivered twice", "all done, milestone already complete", "No update", async () => {
    const sb = fakeSupabase((q) => (q.table === "tasks" ? { data: [tk("1", "a", "done")], error: null } : q.table === "milestones" ? { data: { id: "a", title: "A", completed: true }, error: null } : null));
    assert.deepEqual(await syncMilestoneFromLinkedTasks("p", "a", sb), { completed: false, reopened: false });
    assert.equal(sb.calls.filter((c) => c.op === "update").length, 0);
});
const projectRow = (status, milestones, stages) => (q) => (q.table === "projects" && q.op === "select" ? { data: { id: "p", title: "T", status, milestones }, error: null } : q.table === "tasks" ? { data: stages.map((stage) => ({ stage })), error: null } : null);
kase(id5(), "completeProject", "An unfinished project can't be closed", "one task in review", "Throws, no update", async () => {
    const sb = fakeSupabase(projectRow("in_progress", [M(true)], ["review"]));
    await assert.rejects(completeProject("p", "pm", undefined, sb), /not yet in Accepted/);
    assert.equal(sb.calls.filter((c) => c.op === "update").length, 0);
});
kase(id5(), "reopenProject", "Only a closed project reopens", "status in_progress", "Throws", async () => {
    await assert.rejects(reopenProject("p", fakeSupabase(projectRow("in_progress", [], []))), /Only closed/);
});
kase(id5(), "removeProjectMember", "Leaving a project hands open work back and keeps accepted work credited", "member removed", "Unassign excludes done, then member deleted", async () => {
    const sb = fakeSupabase((q) => (q.table === "projects" ? { data: { status: "in_progress" }, error: null } : null));
    await removeProjectMember("p", "u", sb);
    const update = sb.calls.find((c) => c.table === "tasks" && c.op === "update");
    assert.deepEqual(update.payload, { assigned_to: null });
    assert.ok(update.filters.some(([f, c, v]) => f === "neq" && c === "stage" && v === "done"));
    assert.ok(sb.calls.some((c) => c.table === "project_members" && c.op === "delete"));
});

// ─── UT-06 ──────────────────────────────────────────────────────────────────
const id6 = seq("UT-06");
const tasksDb = (extra = {}) => fakeSupabase((q) => {
    if (q.table === "projects")
        return { data: { status: extra.status ?? "in_progress" }, error: null };
    if (q.table === "tasks" && q.op === "insert")
        return { data: { id: "n" }, error: null };
    if (q.table === "tasks" && q.op === "select" && q.one)
        return { data: extra.max ?? null, error: null };
    return null;
});
kase(id6(), "createTask", "Defaults: To do, medium, first position, trimmed", "title '  Tile  ', no options", "to_do, medium, position 0, 'Tile'", async () => {
    const sb = tasksDb();
    await createTask({ project_id: "p", title: "  Tile  " }, sb);
    const row = sb.calls.find((c) => c.op === "insert").payload;
    assert.deepEqual([row.stage, row.priority, row.position, row.title, row.description], ["to_do", "medium", 0, "Tile", null]);
});
kase(id6(), "createTask", "A new task goes after the column's last", "highest position 7", "position 8", async () => {
    const sb = tasksDb({ max: { position: 7 } });
    await createTask({ project_id: "p", title: "x" }, sb);
    assert.equal(sb.calls.find((c) => c.op === "insert").payload.position, 8);
});
kase(id6(), "createTask", "A closed project takes no new tasks", "project completed", "Throws, no insert", async () => {
    const sb = tasksDb({ status: "completed" });
    await assert.rejects(createTask({ project_id: "p", title: "x" }, sb), /read-only/);
    assert.equal(sb.calls.filter((c) => c.op === "insert").length, 0);
});
kase(id6(), "updateTask", "A closed project's tasks can't change", "project completed", "Throws, no update", async () => {
    const sb = fakeSupabase((q) => (q.table === "tasks" ? { data: { project: { status: "completed" } }, error: null } : null));
    await assert.rejects(updateTask({ id: "t", title: "x" }, sb), /read-only/);
    assert.equal(sb.calls.filter((c) => c.op === "update").length, 0);
});
kase(id6(), "updateTask", "Fields left out aren't overwritten", "{ id, stage } only", "Payload holds stage alone", async () => {
    const sb = fakeSupabase((q) => (q.op === "select" ? { data: { project: { status: "in_progress" } }, error: null } : { data: { id: "t" }, error: null }));
    await updateTask({ id: "t", stage: "review", title: undefined }, sb);
    assert.deepEqual(sb.calls.find((c) => c.op === "update").payload, { stage: "review" });
});
kase(id6(), "claimOpenTask", "Two people claiming at once: the second is told no", "update matches no row", "false", async () => assert.equal(await claimOpenTask("t", "me", fakeSupabase(() => ({ data: [], error: null }))), false));
kase(id6(), "claimOpenTask", "A claim only applies while the task is open", "claim", "Filtered on assigned_to is null", async () => {
    const sb = fakeSupabase(() => ({ data: [{ id: "t" }], error: null }));
    assert.equal(await claimOpenTask("t", "me", sb), true);
    assert.ok(sb.calls[0].filters.some(([f, c, v]) => f === "is" && c === "assigned_to" && v === null));
});
const people = [{ id: "ana", name: "Ana Reyes" }], phases = [{ id: "fit", title: "Fit-out" }], TODAY = "2026-10-15"; // Thursday
const quick = (s) => parseQuickAdd(s, { people, milestones: phases, today: TODAY });
for (const [text, want] of [["Paint @ana #fit fri", { title: "Paint", assigneeId: "ana", milestoneId: "fit", dueDate: "2026-10-16" }], ["Paint @nobody", { title: "Paint @nobody", assigneeId: null, milestoneId: null, dueDate: null }], ["Paint 2026-12-25", { title: "Paint", assigneeId: null, milestoneId: null, dueDate: "2026-12-25" }], ["Paint today", { title: "Paint", assigneeId: null, milestoneId: null, dueDate: TODAY }], ["Paint thu", { title: "Paint", assigneeId: null, milestoneId: null, dueDate: "2026-10-22" }], ["Paint 1/5", { title: "Paint", assigneeId: null, milestoneId: null, dueDate: "2027-01-05" }]])
    kase(id6(), "parseQuickAdd", "One line becomes a task; unknown names stay in the title", text, JSON.stringify(want), () => {
        const parsed = quick(text);
        assert.deepEqual({ title: parsed.title, assigneeId: parsed.assigneeId, milestoneId: parsed.milestoneId, dueDate: parsed.dueDate }, want);
    });
for (const [what, raw, want] of [["not an array", "x", 0], ["null", null, 0], ["items without a label dropped", [{ id: "1", done: true }, null, 5, { id: "2", label: "ok" }], 1]])
    kase(id6(), "parseChecklist", "Malformed checklist data can't break a task", what, `${want} item(s)`, () => assert.equal(board.parseChecklist(raw).length, want));
for (const [what, raw, total, done, complete] of [["empty", [], 0, 0, false], ["partial", [{ label: "a", done: true }, { label: "b" }], 2, 1, false], ["complete", [{ label: "a", done: 1 }], 1, 1, true]])
    kase(id6(), "checklistProgress", "Completion counts", what, `${done}/${total}, complete ${complete}`, () => assert.deepEqual(board.checklistProgress(raw), { total, done, complete }));
kase(id6(), "sortWorkTodayTasks", "Crew see running work first, then by due date", "to_do, review, in_progress", "in_progress, review, to_do", () => assert.deepEqual(flow.sortWorkTodayTasks([{ stage: "to_do", title: "a" }, { stage: "review", title: "b" }, { stage: "in_progress", title: "c" }]).map((t) => t.stage), ["in_progress", "review", "to_do"]));

// ─── UT-07 ──────────────────────────────────────────────────────────────────
const id7 = seq("UT-07");
const task = (stage, assigned_to = "me", milestone_id = null) => ({ id: "t", title: "T", stage, assigned_to, milestone_id, checklist: [], description: null });
const STAGES = ["to_do", "in_progress", "review", "done"];
/** The independently written rule: which moves each role may make. */
const allowed = {
    project_manager: new Set(["to_do>in_progress", "in_progress>review", "review>done", "in_progress>to_do", "review>to_do", "review>in_progress", "done>to_do", "done>in_progress", "done>review"]),
    middleman: new Set(["to_do>in_progress", "in_progress>review"]),
};
for (const role of Object.keys(allowed))
    for (const from of STAGES)
        for (const to of STAGES) {
            if (from === to)
                continue;
            const ok = allowed[role].has(`${from}>${to}`);
            kase(id7(), "validateStageTransition", "Permitted-move matrix", `${role}: ${from} to ${to}`, ok ? "allowed" : "refused", () => assert.equal(board.validateStageTransition(task(from), from, to, role).ok, ok));
        }
kase(id7(), "validateStageTransition", "Same-column reorder is always allowed", "client, review to review", "allowed", () => assert.equal(board.validateStageTransition(task("review"), "review", "review", "client").ok, true));
kase(id7(), "validateStageTransition", "A PM can't start unassigned work", "PM, unassigned to_do", "assignee failure", () => assert.equal(board.validateStageTransition(task("to_do", null), "to_do", "in_progress", "project_manager").failures[0].code, "assignee"));
kase(id7(), "validateStageTransition", "Crew starting open work claims it", "middleman, unassigned to_do", "ok, claimAssignee self", () => assert.equal(board.validateStageTransition(task("to_do", null), "to_do", "in_progress", "middleman").claimAssignee, "self"));
const gate = { milestones: ms, tasks: [tk("x", "a", "review"), tk("t", "b", "to_do")] };
kase(id7(), "validateStageTransition", "Crew can't start a later phase early", "middleman, earlier phase open", "prior_phase failure", () => assert.equal(board.validateStageTransition(task("to_do", "me", "b"), "to_do", "in_progress", "middleman", gate).failures[0].code, "prior_phase"));
kase(id7(), "validateStageTransition", "A PM may start early, after a warning", "PM, earlier phase open", "ok with warning", () => assert.match(board.validateStageTransition(task("to_do", "me", "b"), "to_do", "in_progress", "project_manager", gate).warning, /Start before A/));
for (const [stage, want] of [["backlog", "to_do"], ["to_do", "to_do"], ["done", "done"]])
    kase(id7(), "normalizeBoardStage", "The paper's Backlog column is folded into To do", stage, want, () => assert.equal(board.normalizeBoardStage(stage), want));

const moveDb = (over = {}) => fakeSupabase((q) => {
    if (over.fail && q.table === "tasks" && q.op === "update")
        return { data: null, error: new Error("write failed") };
    if (q.table === "task_attachments")
        return { data: over.files ?? [], error: null };
    if (q.table === "milestones")
        return { data: over.milestones ?? [], error: null };
    if (q.table === "tasks" && q.op === "select" && q.one)
        return { data: { project: { status: over.status ?? "in_progress" } }, error: null };
    if (q.table === "tasks" && q.op === "select")
        return { data: over.tasks ?? [], error: null };
    if (q.table === "tasks" && q.op === "update")
        return { data: { id: "t" }, error: null };
    return null;
}, { userId: "me" });
const writes = (sb) => sb.calls.filter((c) => c.table === "tasks" && c.op === "update");
const move = (sb, t, to, role = "middleman") => (setFake(sb), flow.moveTaskToStage(t, to, role, "me", "p"));

kase(id7(), "moveTaskToStage", "Submitting needs proof of the work", "no attachments", "Throws, no write", async () => {
    const sb = moveDb();
    await assert.rejects(move(sb, task("in_progress"), "review"), /site photo or video/);
    assert.equal(writes(sb).length, 0);
});
kase(id7(), "moveTaskToStage", "A document alone isn't proof", "one PDF", "Throws, no write", async () => {
    const sb = moveDb({ files: [{ media_kind: "file" }] });
    await assert.rejects(move(sb, task("in_progress"), "review"), /site photo or video/);
    assert.equal(writes(sb).length, 0);
});
for (const kind of ["photo", "video"])
    kase(id7(), "moveTaskToStage", "A photo or a video counts as proof", kind, "Stage written as review", async () => {
        const sb = moveDb({ files: [{ media_kind: kind }] });
        await move(sb, task("in_progress"), "review");
        assert.equal(writes(sb)[0].payload.stage, "review");
    });
kase(id7(), "moveTaskToStage", "A move the rules refuse never reaches the database", "middleman, review to done", "Throws, no write", async () => {
    const sb = moveDb();
    await assert.rejects(move(sb, task("review"), "done"), /Only the project manager/);
    assert.equal(writes(sb).length, 0);
});
kase(id7(), "moveTaskToStage", "A skipped stage is refused", "middleman, to_do to review", "Throws one_step, no write", async () => {
    const sb = moveDb();
    await assert.rejects(move(sb, task("to_do"), "review"), /one stage at a time/);
    assert.equal(writes(sb).length, 0);
});
kase(id7(), "moveTaskToStage", "Claiming assigns the person who moved it", "middleman, open to_do", "assigned_to me", async () => {
    const sb = moveDb();
    await move(sb, task("to_do", null), "in_progress");
    assert.equal(writes(sb)[0].payload.assigned_to, "me");
});
kase(id7(), "moveTaskToStage", "Dropping into its own column does nothing", "review to review", "No query", async () => {
    const sb = moveDb();
    await move(sb, task("review"), "review");
    assert.equal(sb.calls.length, 0);
});
kase(id7(), "moveTaskToStage", "A failed write rejects, so the board can put the card back", "update errors", "Rejects, nothing logged", async () => {
    const sb = moveDb({ fail: true, files: [{ media_kind: "photo" }] });
    await assert.rejects(move(sb, task("in_progress"), "review"), /write failed/);
    assert.equal(sb.calls.filter((c) => c.table === "activity_feed").length, 0);
});
kase(id7(), "moveTaskToStage", "A closed project refuses the move", "project completed", "Throws, no write", async () => {
    const sb = moveDb({ status: "completed", files: [{ media_kind: "photo" }] });
    await assert.rejects(move(sb, task("in_progress"), "review"), /read-only/);
    assert.equal(writes(sb).length, 0);
});
kase(id7(), "useTaskActions", "Regression D-13: the PM board accepts the same proof as the service", "source of use-task-actions.ts", "Uses hasSiteEvidence, no photo-only check", () => {
    const src = readFileSync("components/projects/pm/board/use-task-actions.ts", "utf8");
    assert.match(src, /hasSiteEvidence/);
    assert.doesNotMatch(src, /media_kind === "photo"/);
});

// ─── UT-08 ──────────────────────────────────────────────────────────────────
const id8 = seq("UT-08");
const reviewDb = (over = {}) => fakeSupabase((q) => {
    if (over.fail && q.table === "tasks" && q.op === "update")
        return { data: null, error: new Error("denied") };
    if (q.table === "tasks" && q.op === "select" && q.one)
        return { data: { project: { status: over.status ?? "in_progress" } }, error: null };
    if (q.table === "tasks" && q.op === "update")
        return { data: { id: "t" }, error: null };
    if (q.table === "tasks" || q.table === "milestones")
        return { data: [], error: null };
    return null;
}, { userId: "pm" });
const att = (sb) => sb.calls.filter((c) => c.table === "task_attachments" && c.op === "update");

kase(id8(), "acceptTaskDeliverable", "Acceptance publishes the task to the client", "task in review", "stage done, client_visible_at set", async () => {
    const sb = reviewDb();
    await flow.acceptTaskDeliverable(task("review"), "p", sb);
    const u = writes(sb)[0].payload;
    assert.equal(u.stage, "done");
    assert.ok(Date.parse(u.client_visible_at));
});
kase(id8(), "acceptTaskDeliverable", "Only the photos the PM chose are shared", "photoIds [a]", "Update filtered to id in [a]", async () => {
    const sb = reviewDb();
    await flow.acceptTaskDeliverable(task("review"), "p", sb, { photoIds: ["a"] });
    assert.ok(att(sb)[0].filters.some(([f, c, v]) => f === "in" && c === "id" && v[0] === "a" && v.length === 1));
});
kase(id8(), "acceptTaskDeliverable", "Choosing no photos shares none", "photoIds []", "No attachment update", async () => {
    const sb = reviewDb();
    await flow.acceptTaskDeliverable(task("review"), "p", sb, { photoIds: [] });
    assert.equal(att(sb).length, 0);
});
kase(id8(), "acceptTaskDeliverable", "A refused acceptance publishes nothing", "update denied", "Rejects, no photos shared, nothing logged", async () => {
    const sb = reviewDb({ fail: true });
    await assert.rejects(flow.acceptTaskDeliverable(task("review"), "p", sb, { photoIds: ["a"] }), /denied/);
    assert.equal(att(sb).length, 0);
    assert.equal(sb.calls.filter((c) => c.table === "activity_feed").length, 0);
});
kase(id8(), "acceptTaskDeliverable", "A closed project can't accept work", "project completed", "Rejects, no write", async () => {
    const sb = reviewDb({ status: "completed" });
    await assert.rejects(flow.acceptTaskDeliverable(task("review"), "p", sb), /read-only/);
    assert.equal(writes(sb).length, 0);
});
kase(id8(), "sendTaskBackToActive", "The reason reaches the crew as the first checklist item", "reason ' Redo grout '", "in_progress, first item 'Fix: Redo grout'", async () => {
    const sb = reviewDb();
    await flow.sendTaskBackToActive({ ...task("review"), checklist: [{ id: "1", label: "Old", done: true }] }, "p", sb, " Redo grout ");
    const u = writes(sb)[0].payload;
    assert.equal(u.stage, "in_progress");
    assert.deepEqual(u.checklist.map((i) => [i.label, i.done]), [["Fix: Redo grout", false], ["Old", true]]);
});
kase(id8(), "sendTaskBackToActive", "No reason leaves the checklist alone and never publishes", "no reason", "stage only", async () => {
    const sb = reviewDb();
    await flow.sendTaskBackToActive(task("review"), "p", sb);
    assert.deepEqual(writes(sb)[0].payload, { stage: "in_progress" });
});
kase(id8(), "reviewQueue", "Oldest submission first, review stage only", "3 tasks, 2 in review", "Oldest review first", () => assert.deepEqual(reviewQueue([{ stage: "review", updated_at: "2", id: "b" }, { stage: "to_do", updated_at: "0", id: "x" }, { stage: "review", updated_at: "1", id: "a" }]).map((t) => t.id), ["a", "b"]));
kase(id8(), "sendBackChecklist", "A repeat send-back stacks, newest on top", "existing Fix item", "Two Fix items", () => assert.equal(sendBackChecklist([{ id: "1", label: "Fix: old", done: false }], "new", "2")[0].label, "Fix: new"));
