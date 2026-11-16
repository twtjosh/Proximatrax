// The paper's non-functional requirement: dashboard and project list screens
// load within three seconds. Measured on the staging project from this machine,
// five fresh page loads per screen, after one warm-up load.
import { expect, test } from "@playwright/test";
import { mkdirSync, writeFileSync } from "node:fs";
import { email, staging } from "./env.mjs";

const LIMIT_MS = 3000, SAMPLES = 5;
const results = [];

async function signIn(browser, who) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await page.goto("/login");
    await page.waitForLoadState("networkidle");
    await page.getByLabel("Email address").fill(email(who));
    await page.getByLabel("Password", { exact: true }).fill(staging.TEST_PASSWORD);
    await page.getByRole("button", { name: "Sign In" }).click();
    await page.waitForURL((u) => !u.pathname.startsWith("/login"), { timeout: 30_000 });
    await page.waitForLoadState("networkidle");
    return page;
}
const median = (xs) => [...xs].sort((a, b) => a - b)[xs.length >> 1];

test.afterAll(() => {
    if (results.length === 0)
        return;
    mkdirSync("testing-reports/test-evidence/staging", { recursive: true });
    writeFileSync("testing-reports/test-evidence/staging/screen-timing.json", JSON.stringify({ when: new Date().toISOString(), limitMs: LIMIT_MS, conditions: "Production build on this machine (localhost) connected to the Supabase free-tier test project; Edge via Playwright, 1366x850, no throttling; small test dataset; 5 loads after a warm-up", results }, null, 2));
});

for (const [who, path] of [["pm", "/dashboard"], ["pm", "/projects"], ["client1", "/dashboard"], ["client1", "/projects"], ["crew1", "/middleman"], ["admin", "/dashboard"]])
    test(`ST-14.S | ${who} | Screen loads within three seconds (paper NFR) | ${path}: median of ${SAMPLES} loads under ${LIMIT_MS} ms`, async ({ browser }) => {
        const page = await signIn(browser, who);
        await page.goto(path);
        await page.waitForLoadState("networkidle");
        const load = [], ready = [];
        for (let i = 0; i < SAMPLES; i++) {
            const start = Date.now();
            await page.goto(path, { waitUntil: "load" });
            load.push(await page.evaluate(() => Math.round(performance.getEntriesByType("navigation")[0].loadEventEnd)));
            await page.waitForLoadState("networkidle");
            ready.push(Date.now() - start);
        }
        results.push({ who, path, medianLoadMs: median(load), maxLoadMs: Math.max(...load), medianSettledMs: median(ready), maxSettledMs: Math.max(...ready) });
        expect(median(load), `${path} load times ${load.join(", ")} ms`).toBeLessThan(LIMIT_MS);
        await page.context().close();
    });
