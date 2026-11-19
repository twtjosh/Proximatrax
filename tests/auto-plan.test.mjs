import { test } from "node:test";
import assert from "node:assert/strict";
import { assign, buildPlan, sanitizeDraft, schedule, workingDays } from "../lib/auto-plan.ts";

const MON_SAT = [1, 2, 3, 4, 5, 6];
const cal = (start, end, offDates = []) => ({ start, end, weekdays: MON_SAT, offDates });
const task = (title, workingDays = 1, role = "foreman") => ({ title, description: "", workingDays, role });
const ms = (title, ...tasks) => ({ title, tasks });
const allTasks = (plan) => plan.flatMap((m) => m.tasks);

test("workingDays skips unticked weekdays and off dates", () => {
    // 2026-12-06 is a Sunday.
    assert.deepEqual(workingDays(cal("2026-12-01", "2026-12-08", ["2026-12-02"])), ["2026-12-01", "2026-12-03", "2026-12-04", "2026-12-05", "2026-12-07", "2026-12-08"]);
});

test("workingDays is empty when the end is before the start", () => {
    assert.deepEqual(workingDays(cal("2026-12-08", "2026-12-01")), []);
});

test("schedule fills the range exactly, only on working days", () => {
    const c = cal("2026-12-01", "2026-12-09");
    const days = workingDays(c);
    const plan = schedule([ms("A", task("a1"), task("a2")), ms("B", task("b1"), task("b2"))], c);
    const tasks = allTasks(plan);
    assert.equal(tasks[0].start_date, days[0]);
    assert.equal(tasks.at(-1).due_date, days.at(-1));
    assert.equal(plan.at(-1).due_date, days.at(-1));
    for (const t of tasks) {
        assert.ok(days.includes(t.start_date) && days.includes(t.due_date), `${t.title} on a working day`);
        assert.ok(t.start_date <= t.due_date);
    }
});

test("schedule gives longer tasks more days", () => {
    const c = cal("2026-12-01", "2026-12-12"); // 11 working days
    const [m] = schedule([ms("A", task("short", 1), task("long", 9))], c);
    const span = (t) => workingDays({ ...c, start: t.start_date, end: t.due_date }).length;
    assert.ok(span(m.tasks[1]) > span(m.tasks[0]));
});

test("schedule keeps milestone dates strictly increasing when tasks outnumber days", () => {
    const c = cal("2026-12-01", "2026-12-03"); // 3 working days
    const five = (p) => [1, 2, 3, 4, 5].map((i) => task(`${p}${i}`));
    const plan = schedule([ms("A", ...five("a")), ms("B", ...five("b")), ms("C", ...five("c"))], c);
    assert.ok(plan[0].due_date < plan[1].due_date && plan[1].due_date < plan[2].due_date);
    for (const t of allTasks(plan))
        assert.ok(t.start_date <= t.due_date && t.start_date >= c.start && t.due_date <= c.end);
});

test("schedule refuses fewer working days than milestones", () => {
    assert.deepEqual(schedule([ms("A", task("a")), ms("B", task("b")), ms("C", task("c"))], cal("2026-12-01", "2026-12-02")), { error: "too_short" });
});

test("schedule never lands on an off date at the edges", () => {
    const c = cal("2026-12-01", "2026-12-05", ["2026-12-01", "2026-12-05"]);
    const plan = schedule([ms("A", task("a")), ms("B", task("b"))], c);
    assert.equal(allTasks(plan)[0].start_date, "2026-12-02");
    assert.equal(plan.at(-1).due_date, "2026-12-04");
});

test("sanitizeDraft clamps days, drops empty titles and empty milestones, fixes unknown roles", () => {
    const out = sanitizeDraft({ milestones: [
        { title: " Prep ", tasks: [{ title: "Clear", workingDays: 0, role: "wizard" }, { title: "  ", workingDays: 3, role: "foreman" }] },
        { title: "Build", tasks: [{ title: "Tile", workingDays: 99, role: "site_manager", description: "Floor" }] },
        { title: "Empty", tasks: [] },
    ] });
    assert.deepEqual(out, [
        { title: "Prep", tasks: [{ title: "Clear", description: "", workingDays: 1, role: "foreman" }] },
        { title: "Build", tasks: [{ title: "Tile", description: "Floor", workingDays: 30, role: "site_manager" }] },
    ]);
});

test("sanitizeDraft caps milestones at 8 and tasks per milestone at 15", () => {
    const many = Array.from({ length: 12 }, (_, i) => ({ title: `M${i}`, tasks: Array.from({ length: 20 }, (_, j) => ({ title: `t${j}`, workingDays: 1, role: "foreman" })) }));
    const out = sanitizeDraft({ milestones: many });
    assert.equal(out.length, 4); // 4 x 15 = 60 tasks: the total cap stops it first
    assert.ok(out.every((m) => m.tasks.length <= 15));
    assert.equal(out.flatMap((m) => m.tasks).length, 60);
    const few = sanitizeDraft({ milestones: many.map((m) => ({ ...m, tasks: m.tasks.slice(0, 1) })) });
    assert.equal(few.length, 8);
});

test("sanitizeDraft returns null for junk or fewer than 2 usable milestones", () => {
    assert.equal(sanitizeDraft("nope"), null);
    assert.equal(sanitizeDraft({ milestones: "x" }), null);
    assert.equal(sanitizeDraft({ milestones: [{ title: "Only", tasks: [{ title: "a", workingDays: 1, role: "foreman" }] }] }), null);
});

test("schedule overlaps different people's tasks in a milestone, one at a time per person", () => {
    const c = cal("2026-12-01", "2026-12-12"); // 11 working days
    const owned = (title, who, days = 2) => ({ ...task(title, days), planned_to: who });
    const [m] = schedule([ms("A", owned("a1", "p"), owned("a2", "p"), owned("b1", "q"), owned("b2", "q")), ms("B", owned("z", "p"))], c);
    const [a1, a2, b1, b2] = m.tasks;
    assert.equal(a1.start_date, b1.start_date, "both people start together");
    assert.ok(b1.start_date <= a1.due_date && a1.start_date <= b1.due_date, "their tasks overlap");
    assert.ok(a1.due_date < a2.start_date && b1.due_date < b2.start_date, "each person's own tasks follow in order");
    assert.equal(m.tasks.map((t) => t.planned_to).join(), "p,p,q,q");
});

test("assign balances work across people with the task's role", () => {
    const plan = schedule([ms("A", task("1", 2), task("2", 2)), ms("B", task("3", 2), task("4", 2))], cal("2026-12-01", "2026-12-12"));
    const out = assign(plan, [{ id: "f1", name: "F1", role: "foreman" }, { id: "f2", name: "F2", role: "foreman" }, { id: "s", name: "S", role: "site_manager" }]);
    const count = (id) => allTasks(out).filter((t) => t.planned_to === id).length;
    assert.equal(count("f1"), 2);
    assert.equal(count("f2"), 2);
    assert.equal(count("s"), 0);
});

test("assign falls back to the least-loaded member when nobody has the role", () => {
    const plan = schedule([ms("A", task("x", 5, "foreman")), ms("B", task("y", 1, "safety_officer"))], cal("2026-12-01", "2026-12-12"));
    const out = assign(plan, [{ id: "f", name: "F", role: "foreman" }, { id: "s", name: "S", role: "site_manager" }]);
    assert.equal(out[0].tasks[0].planned_to, "f");
    assert.equal(out[1].tasks[0].planned_to, "s");
});

test("assign leaves tasks unplanned when there is no team", () => {
    const plan = schedule([ms("A", task("x")), ms("B", task("y"))], cal("2026-12-01", "2026-12-12"));
    assert.ok(allTasks(assign(plan, [])).every((t) => t.planned_to === null));
});

test("buildPlan reports invalid drafts and too-short dates", () => {
    assert.deepEqual(buildPlan(null, cal("2026-12-01", "2026-12-12"), []), { error: "invalid" });
    const raw = { milestones: [ms("A", task("a")), ms("B", task("b")), ms("C", task("c"))] };
    assert.deepEqual(buildPlan(raw, cal("2026-12-01", "2026-12-02"), []), { error: "too_short" });
    assert.equal(buildPlan(raw, cal("2026-12-01", "2026-12-12"), []).length, 3);
});

test("planProblem accepts a plan made by the rules and names what is wrong with a tampered one", async () => {
    const { planProblem } = await import("../lib/auto-plan.ts");
    const c = cal("2026-12-01", "2026-12-12");
    const team = [{ id: "f", name: "F", role: "foreman" }];
    const good = assign(schedule([ms("A", task("a", 2)), ms("B", task("b", 2))], c), team);
    assert.equal(planProblem(good, c, ["f"]), null);
    const tweak = (fn) => {
        const copy = structuredClone(good);
        fn(copy);
        return planProblem(copy, c, ["f"]);
    };
    assert.match(tweak((p) => (p[0].tasks[0].due_date = "2026-12-20")), /date/);
    assert.match(tweak((p) => (p[0].tasks[0].start_date = "2026-12-06")), /date/); // a Sunday
    assert.match(tweak((p) => (p[1].due_date = p[0].due_date)), /order/);
    assert.match(tweak((p) => (p[0].tasks[0].planned_to = "stranger")), /team/);
    assert.match(tweak((p) => (p[0].tasks[0].title = " ")), /title/);
    assert.match(tweak((p) => (p[0].tasks[0].workingDays = 31)), /days/);
    assert.match(tweak((p) => p.pop()), /milestones/);
    assert.match(tweak((p) => (p[0].tasks = [])), /tasks/);
    assert.match(tweak((p) => (p[0].tasks[0].due_date = p[1].due_date)), /date/); // past its milestone
    assert.match(planProblem("junk", c, []), /plan/);
});

test("planProblem refuses non-text fields and over-long titles from the browser", async () => {
    const { planProblem } = await import("../lib/auto-plan.ts");
    const c = cal("2026-12-01", "2026-12-12");
    const good = assign(schedule([ms("A", task("a", 2)), ms("B", task("b", 2))], c), []);
    const tweak = (fn) => {
        const copy = structuredClone(good);
        fn(copy);
        return planProblem(copy, c, []);
    };
    assert.match(tweak((p) => (p[0].tasks[0].description = 42)), /description/);
    assert.match(tweak((p) => (p[0].tasks[0].title = "x".repeat(161))), /title/);
    assert.match(tweak((p) => (p[0].title = "x".repeat(121))), /title/);
    assert.match(tweak((p) => (p[0].tasks[0].description = "x".repeat(601))), /description/);
});
