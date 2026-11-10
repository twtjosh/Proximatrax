// Signed-in browser flows: a production build wired to the staging Supabase
// project and run on this machine. env.mjs refuses to start on production keys.
import { defineConfig } from "@playwright/test";
import { join } from "node:path";
import { staging } from "./env.mjs";

const root = join(import.meta.dirname, "../..");
const evidence = join(root, "testing-reports/test-evidence/staging/playwright");

export default defineConfig({
    testDir: ".",
    testMatch: "*.spec.mjs",
    outputDir: join(evidence, "artifacts"),
    timeout: 90_000,
    expect: { timeout: 15_000 },
    workers: 1,
    retries: 0,
    reporter: [["list"], ["json", { outputFile: join(evidence, "results.json") }]],
    use: { baseURL: "http://localhost:3200", browserName: "chromium", channel: "msedge", viewport: { width: 1366, height: 850 }, screenshot: "only-on-failure" },
    webServer: {
        command: "npx next build && npx next start -p 3200",
        cwd: root,
        url: "http://localhost:3200",
        reuseExistingServer: false,
        timeout: 420_000,
        env: { NEXT_PUBLIC_SUPABASE_URL: staging.NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_ANON_KEY: staging.NEXT_PUBLIC_SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY: staging.SUPABASE_SERVICE_ROLE_KEY, NEXT_TELEMETRY_DISABLED: "1" },
    },
});
