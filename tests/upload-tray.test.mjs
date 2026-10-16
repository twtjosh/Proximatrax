import { test } from "node:test";
import assert from "node:assert/strict";
import { hasSiteEvidence, mediaCountPhrase } from "../lib/media-kind.ts";
import { formatDuration, formatSize, traySummary } from "../lib/upload-tray.ts";

const MB = 1024 * 1024;

test("hasSiteEvidence: a photo or a video is proof of the work; a PDF alone is not", () => {
    assert.equal(hasSiteEvidence([{ media_kind: "photo" }]), true);
    assert.equal(hasSiteEvidence([{ media_kind: "video" }]), true);
    assert.equal(hasSiteEvidence([{ media_kind: "file" }]), false);
    assert.equal(hasSiteEvidence([]), false);
});

test("mediaCountPhrase: photos and videos counted, files left out, nothing says so", () => {
    assert.equal(mediaCountPhrase([{ media_kind: "photo" }, { media_kind: "photo" }, { media_kind: "video" }, { media_kind: "file" }]), "2 photos · 1 video");
    assert.equal(mediaCountPhrase([{ media_kind: "video" }]), "1 video");
    assert.equal(mediaCountPhrase([{ media_kind: "file" }]), "No photos or videos");
});

test("formatSize", () => {
    assert.equal(formatSize(24.13 * MB), "24.1 MB");
    assert.equal(formatSize(820 * 1024), "820 KB");
    assert.equal(formatSize(300), "1 KB");
});

test("formatDuration", () => {
    assert.equal(formatDuration(42.4), "0:42");
    assert.equal(formatDuration(65), "1:05");
    assert.equal(formatDuration(3723), "1:02:03");
    assert.equal(formatDuration(Number.NaN), null);
});

test("traySummary: what can go up now, and what is too big", () => {
    const items = [
        { size: 3 * MB, type: "image/jpeg", status: "ready" },
        { size: 12 * MB, type: "video/mp4", status: "failed" },
        { size: 72 * MB, type: "video/mp4", status: "ready" },
        { size: 1 * MB, type: "image/png", status: "done" },
    ];
    assert.deepEqual(traySummary(items), { sendable: 2, bytes: 15 * MB, tooBig: 1, text: "2 ready · 15.0 MB" });
    assert.equal(traySummary([]).text, "");
});
