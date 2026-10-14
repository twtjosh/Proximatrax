import { test } from "node:test";
import assert from "node:assert/strict";
import { addMonths, askDraft, buildIcs, monthGrid } from "../lib/calendar.ts";

test("month grid: Sunday-first weeks, padded with nulls, covering every day", () => {
    const weeks = monthGrid("2026-10"); // Oct 1, 2026 is a Thursday
    assert.equal(weeks.length, 5);
    assert.deepEqual(weeks[0], [null, null, null, null, "2026-10-01", "2026-10-02", "2026-10-03"]);
    assert.equal(weeks[4][6], "2026-10-31");
    assert.equal(weeks.flat().filter(Boolean).length, 31);
});

test("month grid: a month starting on Sunday has no leading padding; February in a leap year has 29 days", () => {
    assert.equal(monthGrid("2026-02")[0][0], "2026-02-01");
    assert.equal(monthGrid("2028-02").flat().filter(Boolean).length, 29);
});

test("add months crosses year boundaries both ways", () => {
    assert.equal(addMonths("2026-10", 1), "2026-11");
    assert.equal(addMonths("2026-12", 1), "2027-01");
    assert.equal(addMonths("2026-01", -1), "2025-12");
});

test("ics: an all-day event on the date, ending the next day, text escaped, CRLF lines", () => {
    const ics = buildIcs({ uid: "m1", title: "Handover, kitchen; final", date: "2026-10-31", description: "Modern Bathroom\nRenovation", stamp: "2026-10-14T08:00:00.000Z" });
    assert.ok(ics.startsWith("BEGIN:VCALENDAR\r\n"));
    assert.ok(ics.includes("DTSTART;VALUE=DATE:20261031\r\n"));
    assert.ok(ics.includes("DTEND;VALUE=DATE:20261101\r\n"));
    assert.ok(ics.includes("SUMMARY:Handover\\, kitchen\\; final\r\n"));
    assert.ok(ics.includes("DESCRIPTION:Modern Bathroom\\nRenovation\r\n"));
    assert.ok(ics.includes("DTSTAMP:20261014T080000Z\r\n"));
    assert.ok(ics.includes("UID:m1@proximatrax\r\n"));
    assert.ok(ics.endsWith("END:VCALENDAR\r\n"));
});

test("ask draft: starts the question, keeps what was typed, never doubles the lead", () => {
    assert.equal(askDraft("Design Approval", ""), "About Design Approval: ");
    assert.equal(askDraft("Design Approval", "when do we pick tiles?"), "About Design Approval: when do we pick tiles?");
    assert.equal(askDraft("Design Approval", "About Design Approval: hi"), "About Design Approval: hi");
});
