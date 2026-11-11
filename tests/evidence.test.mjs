import { test } from "node:test";
import assert from "node:assert/strict";
import { assessEvidence, distanceMeters, evidenceChips, evidenceUploadError, isIssuedVideoPath, issuedVideoPath, locate, MAX_VIDEO_BYTES, MAX_VIDEO_SECONDS, parseCoordinates, validFix, videoExtension, videoTooBig } from "../lib/evidence.ts";

test("distanceMeters: one degree of longitude at the equator", () => {
    assert.ok(Math.abs(distanceMeters({ lat: 0, lng: 0 }, { lat: 0, lng: 1 }) - 111_195) < 50);
});

test("assessEvidence: on site, good GPS, true clock → no flags, server time", () => {
    const r = assessEvidence({ serverNow: 1_000_000, deviceNow: 1_000_500, deviceTakenAt: 990_500, fix: { lat: 14.6, lng: 121, accuracy: 20 }, site: { lat: 14.6005, lng: 121 } });
    assert.deepEqual(r.flags, []);
    assert.equal(r.takenAt, new Date(990_000).toISOString());
    assert.ok(r.distanceM > 50 && r.distanceM < 60, String(r.distanceM));
});

test("assessEvidence: no fix → no_location only, distance null", () => {
    assert.deepEqual(assessEvidence({ serverNow: 0, deviceNow: 0, deviceTakenAt: 0, fix: null, site: { lat: 0, lng: 0 } }), { takenAt: new Date(0).toISOString(), distanceM: null, flags: ["no_location"] });
});

test("assessEvidence: clock 3 h ahead, weak GPS, 8 km off → flags in order, time from server", () => {
    const h3 = 3 * 3600_000;
    const r = assessEvidence({ serverNow: 0, deviceNow: h3, deviceTakenAt: h3 - 5000, fix: { lat: 14.6, lng: 121, accuracy: 150 }, site: { lat: 14.672, lng: 121 } });
    assert.deepEqual(r.flags, ["clock_mismatch", "weak_gps", "off_site"]);
    assert.equal(r.takenAt, new Date(-5000).toISOString());
});

test("assessEvidence: no site pin → no_site, distance null", () => {
    const r = assessEvidence({ serverNow: 0, deviceNow: 0, deviceTakenAt: 0, fix: { lat: 1, lng: 1, accuracy: 5 }, site: null });
    assert.deepEqual(r.flags, ["no_site"]);
    assert.equal(r.distanceM, null);
});

test("assessEvidence: shutter time after send time (bad clock math) never lands in the future", () => {
    assert.equal(assessEvidence({ serverNow: 10_000, deviceNow: 0, deviceTakenAt: 5000, fix: null, site: null }).takenAt, new Date(10_000).toISOString());
});

test("parseCoordinates: plain pair and Maps URLs; rejects swapped, degree text and empty", () => {
    assert.deepEqual(parseCoordinates("14.5995, 120.9842"), { lat: 14.5995, lng: 120.9842 });
    assert.deepEqual(parseCoordinates("14.5995,120.9842"), { lat: 14.5995, lng: 120.9842 });
    assert.deepEqual(parseCoordinates("https://www.google.com/maps/@14.5995,120.9842,17z"), { lat: 14.5995, lng: 120.9842 });
    assert.deepEqual(parseCoordinates("https://maps.google.com/?q=14.5995,120.9842"), { lat: 14.5995, lng: 120.9842 });
    assert.deepEqual(parseCoordinates("-33.8688, 151.2093"), { lat: -33.8688, lng: 151.2093 });
    assert.equal(parseCoordinates("120.9842, 14.5995"), null);
    assert.equal(parseCoordinates("14.5995° N, 120.9842° E"), null);
    assert.equal(parseCoordinates(""), null);
});

test("validFix: rejects missing, out-of-range and zero accuracy", () => {
    assert.deepEqual(validFix("14.6", "121", "12"), { lat: 14.6, lng: 121, accuracy: 12 });
    assert.equal(validFix("", "121", "12"), null);
    assert.equal(validFix(null, null, null), null);
    assert.equal(validFix("91", "121", "12"), null);
    assert.equal(validFix("14.6", "121", "0"), null);
});

test("evidenceChips: exact copy", () => {
    assert.deepEqual(evidenceChips({ verified_capture: false, site_distance_m: null, accuracy_m: null, evidence_flags: [] }), [{ tone: "muted", text: "Not verified (older upload or added by the PM)" }]);
    assert.deepEqual(evidenceChips({ verified_capture: true, site_distance_m: 41.6, accuracy_m: 12, evidence_flags: [] }), [{ tone: "ok", text: "On site · 42 m" }]);
    assert.deepEqual(evidenceChips({ verified_capture: true, site_distance_m: 8312, accuracy_m: 140.4, evidence_flags: ["weak_gps", "off_site"] }), [{ tone: "warn", text: "Weak GPS (±140 m)" }, { tone: "warn", text: "8.3 km from site" }]);
    assert.deepEqual(evidenceChips({ verified_capture: true, site_distance_m: 450, accuracy_m: 10, evidence_flags: ["off_site"] }), [{ tone: "warn", text: "450 m from site" }]);
    assert.deepEqual(evidenceChips({ verified_capture: true, site_distance_m: null, accuracy_m: null, evidence_flags: ["clock_mismatch", "no_location"] }), [{ tone: "warn", text: "Phone clock was off" }, { tone: "warn", text: "No location" }]);
    assert.deepEqual(evidenceChips({ verified_capture: true, site_distance_m: null, accuracy_m: 8, evidence_flags: ["no_site"] }), [{ tone: "warn", text: "Site location not set" }]);
});

test("locate: gives up when the location prompt is never answered", async () => {
    const saved = Object.getOwnPropertyDescriptor(globalThis, "navigator");
    Object.defineProperty(globalThis, "navigator", { value: { geolocation: { getCurrentPosition() {} } }, configurable: true });
    try {
        assert.equal(await locate(30), null);
    }
    finally {
        if (saved)
            Object.defineProperty(globalThis, "navigator", saved);
    }
});

test("parseCoordinates: an address is not a pin", () => {
    assert.equal(parseCoordinates("Unit 5, 12 Rizal St"), null);
    assert.equal(parseCoordinates("629 J. Nepomuceno St, Quiapo, Manila"), null);
});

test("evidenceUploadError: too big before sending, Vercel's 413, server's own message", () => {
    assert.equal(evidenceUploadError({ size: 5 * 1024 * 1024 }), "Photo is too large. Take it again.");
    assert.equal(evidenceUploadError({ size: 1000 }), null);
    assert.equal(evidenceUploadError({ size: 1000 }, 413, null), "Photo is too large. Take it again.");
    assert.equal(evidenceUploadError({ size: 1000 }, 409, { error: "This task is already in review or done." }), "This task is already in review or done.");
    assert.equal(evidenceUploadError({ size: 1000 }, 500, null), "The photo didn't save. Check your signal and try again.");
});

test("videoExtension: only the containers phones record", () => {
    assert.equal(videoExtension("video/mp4"), "mp4");
    assert.equal(videoExtension("video/mp4;codecs=avc1"), "mp4");
    assert.equal(videoExtension("video/webm;codecs=vp9"), "webm");
    assert.equal(videoExtension("video/quicktime"), null);
    assert.equal(videoExtension("image/jpeg"), null);
});

test("issuedVideoPath / isIssuedVideoPath: the server only finishes paths it handed out for this task", () => {
    const P = "11111111-1111-4111-8111-111111111111", T = "22222222-2222-4222-8222-222222222222", U = "33333333-3333-4333-8333-333333333333";
    const path = issuedVideoPath(P, T, U, "webm");
    assert.equal(path, `${P}/${T}/${U}-site-video.webm`);
    assert.equal(isIssuedVideoPath(path, P, T), true);
    assert.equal(isIssuedVideoPath(`${P}/${T}/${U}-site-video.mp4`, P, T), true);
    assert.equal(isIssuedVideoPath(path, P, U), false, "another task");
    assert.equal(isIssuedVideoPath(`${P}/${T}/${U}-site-photo.jpg`, P, T), false, "a photo");
    assert.equal(isIssuedVideoPath(`${P}/${T}/../${U}-site-video.mp4`, P, T), false, "traversal");
    assert.equal(isIssuedVideoPath(`${P}/${T}/old-clip.mp4`, P, T), false, "not issued");
});

test("videoTooBig: the storage bucket's 50 MB cap", () => {
    assert.equal(videoTooBig(MAX_VIDEO_BYTES), false);
    assert.equal(videoTooBig(MAX_VIDEO_BYTES + 1), true);
    assert.equal(MAX_VIDEO_SECONDS, 30);
});
