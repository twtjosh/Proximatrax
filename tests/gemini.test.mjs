import { afterEach, test } from "node:test";
import assert from "node:assert/strict";
import { AiBusyError, BUSY_MESSAGE, generateJson } from "../lib/gemini.ts";

const realFetch = globalThis.fetch;
afterEach(() => {
    globalThis.fetch = realFetch;
});
const answer = (text, status = 200) => new Response(JSON.stringify({ candidates: [{ content: { parts: [{ text }] } }] }), { status });
/** Replies in turn; records each request. */
function stub(...replies) {
    const calls = [];
    globalThis.fetch = async (url, init) => {
        calls.push({ url: String(url), init, body: JSON.parse(init.body) });
        const next = replies.shift();
        if (next instanceof Error)
            throw next;
        return typeof next === "function" ? next(init) : next;
    };
    return calls;
}
const opts = { key: "test-key", model: "test-model" };
const schema = { type: "object", properties: { ok: { type: "boolean" } } };

test("generateJson posts the parts and schema, then parses the JSON answer", async () => {
    const calls = stub(answer('{"ok":true}'));
    assert.deepEqual(await generateJson([{ text: "hi" }], schema, opts), { ok: true });
    assert.equal(calls.length, 1);
    assert.match(calls[0].url, /\/models\/test-model:generateContent$/);
    assert.equal(calls[0].init.headers["x-goog-api-key"], "test-key");
    assert.deepEqual(calls[0].body.contents[0].parts, [{ text: "hi" }]);
    assert.equal(calls[0].body.generationConfig.responseMimeType, "application/json");
    assert.deepEqual(calls[0].body.generationConfig.responseJsonSchema, schema);
});

test("a rate limit is the busy error", async () => {
    stub(new Response("{}", { status: 429 }));
    await assert.rejects(generateJson([{ text: "hi" }], schema, opts), (e) => e instanceof AiBusyError && e.message === BUSY_MESSAGE);
});

test("an overloaded Google (5xx) is tried once more after a pause", async () => {
    const calls = stub(new Response("{}", { status: 503 }), answer('{"ok":true}'));
    assert.deepEqual(await generateJson([{ text: "hi" }], schema, { ...opts, retryDelayMs: 1 }), { ok: true });
    assert.equal(calls.length, 2);
});

test("a server error twice is the busy error", async () => {
    const calls = stub(new Response("{}", { status: 503 }), new Response("{}", { status: 500 }));
    await assert.rejects(generateJson([{ text: "hi" }], schema, { ...opts, retryDelayMs: 1 }), AiBusyError);
    assert.equal(calls.length, 2);
});

test("a missing key is a plain error naming GEMINI_API_KEY", async () => {
    stub();
    await assert.rejects(generateJson([{ text: "hi" }], schema, { model: "m", key: "" }), (e) => !(e instanceof AiBusyError) && /GEMINI_API_KEY/.test(e.message));
});

test("invalid JSON is retried once", async () => {
    const calls = stub(answer("not json"), answer('{"ok":false}'));
    assert.deepEqual(await generateJson([{ text: "hi" }], schema, opts), { ok: false });
    assert.equal(calls.length, 2);
});

test("invalid JSON twice is the busy error", async () => {
    const calls = stub(answer("nope"), answer("still nope"));
    await assert.rejects(generateJson([{ text: "hi" }], schema, opts), AiBusyError);
    assert.equal(calls.length, 2);
});

test("an answer with no candidates is retried like invalid JSON", async () => {
    const calls = stub(new Response(JSON.stringify({ candidates: [] }), { status: 200 }), answer('{"ok":true}'));
    assert.deepEqual(await generateJson([{ text: "hi" }], schema, opts), { ok: true });
    assert.equal(calls.length, 2);
});

test("a timeout is the busy error", async () => {
    stub((init) => new Promise((_, reject) => init.signal.addEventListener("abort", () => reject(init.signal.reason))));
    await assert.rejects(generateJson([{ text: "hi" }], schema, { ...opts, timeoutMs: 20 }), AiBusyError);
});
