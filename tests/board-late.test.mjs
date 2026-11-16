import { test } from "node:test";
import assert from "node:assert/strict";
import { splitLate } from "../lib/board-workflow.ts";

const TODAY = "2026-12-10";
const t = (id, due_date, stage = "in_progress") => ({ id, due_date, stage });

test("splitLate: past due and not accepted is late; accepted, due today, or undated is on time", () => {
    const { late, onTime } = splitLate([t("a", "2026-12-09"), t("b", "2026-12-01", "done"), t("c", TODAY), t("d", null), t("e", "2026-12-01", "review")], TODAY);
    assert.deepEqual(late.map((x) => x.id), ["a", "e"]);
    assert.deepEqual(onTime.map((x) => x.id), ["b", "c", "d"]);
});

test("splitLate keeps the order it was given", () => {
    const { late } = splitLate([t("z", "2026-12-01"), t("y", "2026-12-05"), t("x", "2026-11-01")], TODAY);
    assert.deepEqual(late.map((x) => x.id), ["z", "y", "x"]);
});
