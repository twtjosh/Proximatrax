import { test } from "node:test";
import assert from "node:assert/strict";
import { INQUIRY_LIMITS, parseInquiry } from "../lib/inquiry-input.ts";

test("parseInquiry trims, lowercases the address and accepts a normal inquiry", () => {
    assert.deepEqual(parseInquiry({ name: " Ana ", email: " Ana@Mail.COM ", message: " A kitchen " }), { ok: true, value: { name: "Ana", email: "ana@mail.com", message: "A kitchen" } });
});

test("parseInquiry rejects missing, blank, non-text, oversized and malformed input", () => {
    const ok = { name: "Ana", email: "ana@mail.com", message: "Hi" };
    for (const body of [null, undefined, "text", {}, { ...ok, name: "   " }, { ...ok, message: 42 }, { ...ok, email: ["a@b.co"] },
        { ...ok, name: "x".repeat(INQUIRY_LIMITS.name + 1) }, { ...ok, message: "x".repeat(INQUIRY_LIMITS.message + 1) },
        { ...ok, email: "not-an-email" }, { ...ok, email: "a@b" }, { ...ok, email: "a b@c.co" }])
        assert.equal(parseInquiry(body).ok, false, JSON.stringify(body)?.slice(0, 60));
    assert.equal(parseInquiry({ ...ok, message: "x".repeat(INQUIRY_LIMITS.message) }).ok, true);
});
