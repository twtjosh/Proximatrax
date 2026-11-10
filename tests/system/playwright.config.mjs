// Local projects drive a production build wired to a dead Supabase URL, so they
// can't touch real data. prod-readonly only GETs public pages, and every
// non-GET request in it is aborted. Chromium is exercised through installed
// Edge (the same engine); no Playwright Chromium build is on this machine.
import { defineConfig } from "@playwright/test";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "../..");
const evidence = join(root, "testing-reports/test-evidence/playwright");
const PORT = 3100;
const local = { baseURL: `http://127.0.0.1:${PORT}` };

export default defineConfig({
    testDir: ".",
    testMatch: "*.spec.mjs",
    outputDir: join(evidence, "artifacts"),
    timeout: 45_000,
    fullyParallel: false,
    workers: 1,
    retries: 0,
    reporter: [["list"], ["json", { outputFile: join(evidence, "results.json") }], ["html", { outputFolder: join(evidence, "html"), open: "never" }]],
    use: { screenshot: "only-on-failure", trace: "off", reducedMotion: "reduce" },
    webServer: {
        command: "npx next start -p 3100",
        cwd: root,
        url: `http://127.0.0.1:${PORT}`,
        reuseExistingServer: false,
        timeout: 60_000,
        env: { NEXT_PUBLIC_SUPABASE_URL: "http://127.0.0.1:54399", NEXT_PUBLIC_SUPABASE_ANON_KEY: "stub-anon", SUPABASE_SERVICE_ROLE_KEY: "stub-service", NEXT_TELEMETRY_DISABLED: "1" },
    },
    projects: [
        { name: "local-chromium", testMatch: "public.spec.mjs", use: { ...local, browserName: "chromium", channel: "msedge" } },
        { name: "local-firefox", testMatch: "public.spec.mjs", use: { ...local, browserName: "firefox" } },
        { name: "local-webkit", testMatch: "public.spec.mjs", use: { ...local, browserName: "webkit" } },
        { name: "prod-readonly", testMatch: "prod-readonly.spec.mjs", use: { baseURL: "https://proximatrax.vercel.app", browserName: "chromium", channel: "msedge" } },
    ],
});
