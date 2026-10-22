import { test } from "node:test";
import assert from "node:assert/strict";
import { sanitizeNextPath } from "../lib/constants.ts";

test("sanitizeNextPath keeps in-app paths and drops anything that leaves the site", () => {
    assert.equal(sanitizeNextPath("/projects/1?tab=board"), "/projects/1?tab=board");
    for (const v of ["https://evil.com", "//evil.com", "/\\evil.com", "/\\/evil.com", "/a\tb", "/a\nb", "evil.com", "", null, undefined])
        assert.equal(sanitizeNextPath(v), null, JSON.stringify(v));
});

test("sanitizeNextPath never sends a signed-in user back to the sign-in pages", () => {
    assert.equal(sanitizeNextPath("/login"), null);
    assert.equal(sanitizeNextPath("/forgot-password/x"), null);
});
