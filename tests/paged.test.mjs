import { test } from "node:test";
import assert from "node:assert/strict";
import { readAll } from "../lib/paged.ts";

/** A fake query over `n` rows that, like Supabase, returns at most `cap` rows per call. */
function source(n, cap = 1000) {
    const calls = [];
    const page = async (from, to) => {
        calls.push([from, to]);
        const end = Math.min(to + 1, from + cap, n);
        return { data: Array.from({ length: Math.max(0, end - from) }, (_, i) => from + i), error: null };
    };
    return { page, calls };
}

test("readAll: reads past the per-response cap until a short page", async () => {
    const s = source(2500);
    const { data, error } = await readAll(s.page);
    assert.equal(error, null);
    assert.equal(data.length, 2500);
    assert.deepEqual(s.calls, [[0, 999], [1000, 1999], [2000, 2999]]);
});

test("readAll: an exact multiple of the page size ends on an empty page", async () => {
    const s = source(2000);
    assert.equal((await readAll(s.page)).data.length, 2000);
    assert.equal(s.calls.length, 3);
});

test("readAll: stops at the first error and reports it", async () => {
    const boom = new Error("boom");
    const { data, error } = await readAll(async (from) => (from === 0 ? { data: [1, 2], error: null } : { data: null, error: boom }), 2);
    assert.equal(error, boom);
    assert.deepEqual(data, [1, 2]);
});
