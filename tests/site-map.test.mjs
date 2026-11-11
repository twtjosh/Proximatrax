import { test } from "node:test";
import assert from "node:assert/strict";
import { chromeIntentUrl, inAppBrowser } from "../lib/in-app-browser.ts";
import { placeResults, placeSearchUrl } from "../lib/place-search.ts";

const CHROME = "Mozilla/5.0 (Linux; Android 14; SM-A546E) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/130.0.0.0 Mobile Safari/537.36";
const MESSENGER = CHROME + " [FB_IAB/Orca-Android;FBAV/480.0.0.42.110;]";
const FACEBOOK = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148 [FBAN/FBIOS;FBAV/470.0]";
const INSTAGRAM = CHROME + " Instagram 330.0.0.40.92 Android";
const SAFARI = "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Mobile/15E148 Safari/604.1";

test("inAppBrowser: Messenger, Facebook and Instagram, not Chrome or Safari", () => {
    assert.deepEqual(inAppBrowser(MESSENGER), { android: true });
    assert.deepEqual(inAppBrowser(FACEBOOK), { android: false });
    assert.deepEqual(inAppBrowser(INSTAGRAM), { android: true });
    assert.equal(inAppBrowser(CHROME), null);
    assert.equal(inAppBrowser(SAFARI), null);
    assert.equal(inAppBrowser(""), null);
});

test("chromeIntentUrl: reopens the same page in Chrome on Android", () => {
    assert.equal(chromeIntentUrl("https://x-3200.asse.devtunnels.ms/projects/abc?task=t1"), "intent://x-3200.asse.devtunnels.ms/projects/abc?task=t1#Intent;scheme=https;package=com.android.chrome;end");
});

test("placeSearchUrl: one Philippine search, English names, five results", () => {
    const u = new URL(placeSearchUrl("National Teachers College"));
    assert.equal(u.origin + u.pathname, "https://nominatim.openstreetmap.org/search");
    assert.equal(u.searchParams.get("q"), "National Teachers College");
    assert.equal(u.searchParams.get("format"), "jsonv2");
    assert.equal(u.searchParams.get("countrycodes"), "ph");
    assert.equal(u.searchParams.get("limit"), "5");
});

test("placeResults: keeps valid places, drops junk", () => {
    assert.deepEqual(placeResults([
        { lat: "14.6012", lon: "120.9876", display_name: "National Teachers College, Quiapo, Manila" },
        { lat: "x", lon: "120", display_name: "Broken" },
        { lat: "91", lon: "120", display_name: "Off the map" },
        null,
    ]), [{ lat: 14.6012, lng: 120.9876, name: "National Teachers College, Quiapo, Manila" }]);
    assert.deepEqual(placeResults({ error: "rate limited" }), []);
});
