import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_UPLOAD_MB, uploadTooBig } from "../lib/media-kind.ts";

const MB = 1024 * 1024;

test("uploadTooBig: fits up to the cap, then names the kind and both sizes", () => {
    assert.equal(uploadTooBig({ size: MAX_UPLOAD_MB * MB, type: "video/mp4" }), null);
    assert.equal(uploadTooBig({ size: 72.4 * MB, type: "video/mp4" }), "Videos can be up to 50 MB. This one is 72.4 MB.");
    assert.equal(uploadTooBig({ size: 51 * MB, type: "image/jpeg" }), "Photos can be up to 50 MB. This one is 51.0 MB.");
    assert.equal(uploadTooBig({ size: 60 * MB, type: "" }), "Files can be up to 50 MB. This one is 60.0 MB.");
});
