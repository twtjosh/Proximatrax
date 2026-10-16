import { test } from "node:test";
import assert from "node:assert/strict";
import { DEFAULT_LIFECYCLE_TEMPLATE, templateMilestones } from "../lib/milestone-template.ts";
import { addWeeks, clientContext, crewContext, endDateError, missingPhrase, spanPhrase } from "../lib/new-project.ts";

test("templateMilestones: five milestones evenly across the span, the last on the end date", () => {
    assert.deepEqual(templateMilestones("2026-10-16", "2026-12-11"), [
        { title: "Site Survey", due_date: "2026-10-27" },
        { title: "Design Approval", due_date: "2026-11-07" },
        { title: "Site Preparation", due_date: "2026-11-18" },
        { title: "Construction", due_date: "2026-11-29" },
        { title: "Handover", due_date: "2026-12-11" },
    ]);
    assert.equal(DEFAULT_LIFECYCLE_TEMPLATE.length, 5);
});

test("templateMilestones: none for a missing or backwards range; a one-day project puts all five on its dates", () => {
    assert.equal(templateMilestones("", "2026-12-11"), null);
    assert.equal(templateMilestones("2026-12-11", "2026-10-16"), null);
    assert.deepEqual(templateMilestones("2026-10-16", "2026-10-16").map((m) => m.due_date), Array(5).fill("2026-10-16"));
});

test("spanPhrase: weeks, weeks and days, or days", () => {
    assert.equal(spanPhrase("2026-10-16", "2026-12-11"), "8 weeks");
    assert.equal(spanPhrase("2026-10-16", "2026-12-14"), "8 weeks 3 days");
    assert.equal(spanPhrase("2026-10-16", "2026-10-21"), "5 days");
    assert.equal(spanPhrase("2026-10-16", "2026-10-16"), "Same day");
    assert.equal(spanPhrase("2026-10-16", ""), null);
    assert.equal(spanPhrase("2026-10-16", "2026-10-01"), null);
});

test("addWeeks", () => {
    assert.equal(addWeeks("2026-10-16", 8), "2026-12-11");
    assert.equal(addWeeks("2026-12-25", 2), "2027-01-08");
});

test("endDateError: only when both dates are set and the end comes first", () => {
    assert.equal(endDateError("2026-10-16", "2026-10-15"), "The end date is before the start date. Pick Oct 16 or later.");
    assert.equal(endDateError("2026-10-16", "2026-10-16"), null);
    assert.equal(endDateError("2026-10-16", ""), null);
});

test("missingPhrase: names what is left, in form order", () => {
    assert.equal(missingPhrase({ title: " ", clientId: "", middlemanId: "", startDate: "2026-10-16", endDate: "" }), "Add a title, a client, a middleman and an end date");
    assert.equal(missingPhrase({ title: "Salcedo", clientId: "c", middlemanId: "", startDate: "2026-10-16", endDate: "2026-12-11" }), "Add a middleman");
    assert.equal(missingPhrase({ title: "Salcedo", clientId: "c", middlemanId: "m", startDate: "2026-10-16", endDate: "2026-12-11" }), null);
});

const projects = [
    { id: "p1", client_id: "teresa", status: "in_progress" },
    { id: "p2", client_id: "teresa", status: "completed" },
    { id: "p3", client_id: "victor", status: "pending_invites" },
];

test("clientContext: projects with this PM, all time", () => {
    assert.equal(clientContext("teresa", projects), "Client on 2 of your projects");
    assert.equal(clientContext("victor", projects), "Client on 1 of your projects");
    assert.equal(clientContext("mika", projects), "New to you");
});

test("crewContext: active projects they are on or invited to, each counted once", () => {
    const members = [{ project_id: "p1", user_id: "arnel" }, { project_id: "p2", user_id: "arnel" }, { project_id: "p1", user_id: "jessa" }];
    const invites = [{ project_id: "p3", invitee_id: "arnel" }, { project_id: "p1", invitee_id: "jessa" }];
    assert.equal(crewContext("arnel", projects, members, invites), "On 2 of your active projects");
    assert.equal(crewContext("jessa", projects, members, invites), "On 1 of your active projects");
    assert.equal(crewContext("dennis", projects, members, invites), "Not on your active projects");
});
