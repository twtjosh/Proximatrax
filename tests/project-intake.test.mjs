import { test } from "node:test";
import assert from "node:assert/strict";
import { emptyIntake, intakeCalendar, intakeMissing, matchReadIntake, planPrompt, PLAN_SCHEMA, READ_SCHEMA, WORK_TYPES } from "../lib/project-intake.ts";

const filled = () => ({
    ...emptyIntake("2026-12-01"),
    title: "Santos kitchen",
    clientId: "c1",
    endDate: "2027-02-20",
    team: ["m1"],
    areas: [{ name: "Kitchen", work: ["Cabinetry", "Tiling"], sqm: 12, notes: "Matte black handles" }],
});

test("emptyIntake starts today, Monday to Saturday, with one empty area", () => {
    const i = emptyIntake("2026-12-01");
    assert.equal(i.startDate, "2026-12-01");
    assert.deepEqual(i.weekdays, [1, 2, 3, 4, 5, 6]);
    assert.equal(i.areas.length, 1);
    assert.deepEqual(i.areas[0].work, []);
});

test("WORK_TYPES lists the thirteen kinds of work in order", () => {
    assert.equal(WORK_TYPES.length, 13);
    assert.equal(WORK_TYPES[0], "Demolition");
    assert.equal(WORK_TYPES.at(-1), "Cleaning & turnover");
});

test("intakeMissing names what is missing, and nothing when complete", () => {
    const empty = intakeMissing(emptyIntake("2026-12-01"));
    for (const part of ["a title", "a client", "an end date", "the team", "the scope of work"])
        assert.ok(empty.includes(part), `${empty} mentions ${part}`);
    assert.equal(intakeMissing(filled()), null);
});

test("intakeMissing wants at least one work type, and a sensible date range", () => {
    assert.match(intakeMissing({ ...filled(), areas: [{ name: "Kitchen", work: [], sqm: null, notes: "" }] }), /scope of work/);
    assert.match(intakeMissing({ ...filled(), endDate: "2026-11-01" }), /end date/);
    assert.match(intakeMissing({ ...filled(), weekdays: [] }), /working day/);
});

test("intakeCalendar carries the dates, working weekdays and off dates", () => {
    assert.deepEqual(intakeCalendar({ ...filled(), offDates: ["2026-12-25"] }), { start: "2026-12-01", end: "2027-02-20", weekdays: [1, 2, 3, 4, 5, 6], offDates: ["2026-12-25"] });
});

test("planPrompt describes the job and the team without any ids", () => {
    const prompt = planPrompt({ ...filled(), notes: "No work on Sundays" }, [{ name: "Jose Reyes", role: "foreman" }]);
    for (const s of ["Kitchen", "Cabinetry", "Tiling", "12", "Matte black handles", "foreman", "No work on Sundays", "2026-12-01", "2027-02-20"])
        assert.ok(prompt.includes(s), `prompt includes ${s}`);
    assert.match(prompt, /\b2\b[^.]*\b8\b/);
    assert.ok(!prompt.includes("c1") && !prompt.includes("m1"));
    assert.ok(!prompt.includes("Jose Reyes"), "names stay on our side");
});

test("PLAN_SCHEMA asks for milestones with tasks, days and a crew role", () => {
    const task = PLAN_SCHEMA.properties.milestones.items.properties.tasks.items;
    assert.deepEqual(task.properties.role.enum, ["site_manager", "foreman", "safety_officer"]);
    assert.deepEqual(task.required, ["title", "description", "workingDays", "role"]);
    assert.equal(PLAN_SCHEMA.properties.milestones.maxItems, 8);
});

test("READ_SCHEMA reads names as text, never ids", () => {
    assert.ok(READ_SCHEMA.properties.clientName && READ_SCHEMA.properties.teamNames);
    assert.ok(!READ_SCHEMA.properties.clientId);
});

test("matchReadIntake matches people by name and marks only what it filled", () => {
    const clients = [{ id: "c1", name: "Maria Santos" }];
    const crew = [{ id: "m1", name: "Jose Reyes" }, { id: "m2", name: "Ana Lim" }];
    const read = {
        title: " Santos kitchen ", clientName: "maria  SANTOS", teamNames: ["jose reyes", "Nobody Here"],
        startDate: "2026-12-01", endDate: "not a date",
        areas: [{ name: "Kitchen", work: ["Tiling", "Juggling"], sqm: 12, notes: "" }],
        workingDays: ["Mon", "Tue", "Wednesday"], offDates: ["2026-12-25", "xmas"], notes: "",
    };
    const { intake, filled: got } = matchReadIntake(read, clients, crew, "2026-11-17");
    assert.equal(intake.title, "Santos kitchen");
    assert.equal(intake.clientId, "c1");
    assert.deepEqual(intake.team, ["m1"]);
    assert.equal(intake.startDate, "2026-12-01");
    assert.equal(intake.endDate, "");
    assert.deepEqual(intake.areas, [{ name: "Kitchen", work: ["Tiling"], sqm: 12, notes: "" }]);
    assert.deepEqual(intake.weekdays, [1, 2, 3]);
    assert.deepEqual(intake.offDates, ["2026-12-25"]);
    assert.deepEqual(got.sort(), ["areas", "clientId", "offDates", "startDate", "team", "title", "weekdays"].sort());
});

test("matchReadIntake on junk gives an empty report", () => {
    const { intake, filled: got } = matchReadIntake(null, [], [], "2026-11-17");
    assert.deepEqual(intake, emptyIntake("2026-11-17"));
    assert.deepEqual(got, []);
});

test("asIntake keeps a well-formed report and refuses a malformed one", async () => {
    const { asIntake } = await import("../lib/project-intake.ts");
    const good = { ...filled(), site: { lat: 14.6, lng: 121 }, offDates: ["2026-12-25"] };
    assert.deepEqual(asIntake(good), good);
    assert.equal(asIntake(null), null);
    assert.equal(asIntake({ ...good, team: "m1" }), null);
    assert.equal(asIntake({ ...good, areas: [{ name: 1 }] }), null);
    assert.equal(asIntake({ ...good, startDate: "soon" }), null);
    assert.equal(asIntake({ ...good, weekdays: [9] }), null);
    assert.equal(asIntake({ ...good, site: { lat: 200, lng: 0 } }), null);
    assert.deepEqual(asIntake({ ...good, areas: [{ ...good.areas[0], work: ["Tiling", "Juggling"] }] }).areas[0].work, ["Tiling"]);
});

test("impossible calendar dates are not read from a scan", () => {
    const { intake } = matchReadIntake({ startDate: "2026-02-31", endDate: "2026-02-28" }, [], [], "2026-01-10");
    assert.equal(intake.startDate, "2026-01-10");
    assert.equal(intake.endDate, "2026-02-28");
});

test("intakeMissing refuses a project longer than three years", () => {
    assert.match(intakeMissing({ ...filled(), endDate: "2030-01-01" }), /three years/);
    assert.equal(intakeMissing({ ...filled(), endDate: "2029-11-30" }), null);
});
