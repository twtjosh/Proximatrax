// The deployed site, read-only: public pages and signed-out redirects. Every
// non-GET request is aborted, so nothing can be submitted. Three samples per
// page: enough for a benchmark, far from a load test.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const OUT = join(dirname(fileURLToPath(import.meta.url)), "../../testing-reports/test-evidence/performance-production.json");
const samples = [];

test.beforeEach(async ({ page }) => {
    await page.route("**/*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
});
test.afterAll(() => {
    // A failed test restarts the worker; only the run that holds the samples writes them.
    if (samples.length === 0)
        return;
    mkdirSync(dirname(OUT), { recursive: true });
    const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];
    const pages = [...new Set(samples.map((s) => s.path))].map((path) => {
        const of = samples.filter((s) => s.path === path);
        return { path, samples: of.length, medianTtfbMs: median(of.map((s) => s.ttfb)), medianLoadMs: median(of.map((s) => s.load)), medianLcpMs: median(of.map((s) => s.lcp)), maxCls: Math.max(...of.map((s) => s.cls)), consoleErrors: Math.max(...of.map((s) => s.errors)) };
    });
    writeFileSync(OUT, JSON.stringify({ when: new Date().toISOString(), site: "https://proximatrax.vercel.app", conditions: "One browser (Edge via Playwright, desktop 1366x800), no throttling, this workstation's internet connection, new browser context per sample", pages, raw: samples }, null, 2));
});

let n = 0;
for (const path of ["/", "/login", "/forgot-password", "/terms", "/data-retention"]) {
    test(`ST-14.${String(++n).padStart(2, "0")} | visitor | Production page answers and is measured (3 samples) | ${path} returns 200`, async ({ browser }) => {
        for (let i = 0; i < 3; i++) {
            const context = await browser.newContext({ viewport: { width: 1366, height: 800 } });
            const page = await context.newPage();
            await page.route("**/*", (route) => (route.request().method() === "GET" ? route.continue() : route.abort()));
            let errors = 0;
            page.on("console", (m) => m.type() === "error" && errors++);
            await page.addInitScript(() => {
                window.__lcp = 0;
                window.__cls = 0;
                new PerformanceObserver((l) => l.getEntries().forEach((e) => (window.__lcp = e.startTime))).observe({ type: "largest-contentful-paint", buffered: true });
                new PerformanceObserver((l) => l.getEntries().forEach((e) => !e.hadRecentInput && (window.__cls += e.value))).observe({ type: "layout-shift", buffered: true });
            });
            const res = await page.goto(path, { waitUntil: "load" });
            expect(res.status()).toBe(200);
            await page.waitForTimeout(1500);
            const m = await page.evaluate(() => {
                const nav = performance.getEntriesByType("navigation")[0];
                return { ttfb: Math.round(nav.responseStart), load: Math.round(nav.loadEventEnd), lcp: Math.round(window.__lcp), cls: Number(window.__cls.toFixed(4)) };
            });
            samples.push({ path, ...m, errors });
            await context.close();
        }
    });
}
for (const path of ["/dashboard", "/projects", "/settings", "/inquiries", "/middleman"])
    test(`ST-14.${String(++n).padStart(2, "0")} | anonymous | Deployed site guards private pages | ${path} redirects to sign-in`, async ({ page }) => {
        await page.goto(path);
        await page.waitForURL("**/login**");
    });
test(`ST-14.${String(++n).padStart(2, "0")} | visitor | Deployed page carries the five-step journey the paper's scope describes | Landing shows the inquiry form and sign-in`, async ({ page }) => {
    await page.goto("/");
    await expect(page.locator("#inquiry-name")).toBeAttached();
    await expect(page.locator('a[href="/login"]').first()).toBeAttached();
});
test(`ST-15.90 | visitor | Deployed responses carry transport security | HTTPS with HSTS`, async ({ request }) => {
    const res = await request.get("/");
    expect(res.url().startsWith("https://")).toBe(true);
    expect(res.headers()["strict-transport-security"]).toBeTruthy();
});
for (const [header, name] of [["x-frame-options", "clickjacking"], ["content-security-policy", "script injection"], ["x-content-type-options", "MIME sniffing"], ["referrer-policy", "referrer leakage"]])
    test(`ST-15.9${["x-frame-options", "content-security-policy", "x-content-type-options", "referrer-policy"].indexOf(header) + 1} | visitor | Browser hardening header against ${name} | ${header} present`, async ({ request }) => {
        expect((await request.get("/")).headers()[header], header).toBeTruthy();
    });
