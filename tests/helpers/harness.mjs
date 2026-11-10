// Shared by the unit and integration suites.
// `kase` names a test "ID | function | purpose | input | expected"; tests/report.mjs
// reads those fields back out of the run's results, so a report row can only
// exist if the test actually ran.
import { registerHooks } from "node:module";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";
import { test } from "node:test";

const ROOT = join(import.meta.dirname, "../..");
const STUBS = join(import.meta.dirname, "stubs.mjs");
const STUBBED = new Set(["@/lib/supabase/client", "@/lib/supabase/server", "@supabase/ssr", "@supabase/supabase-js", "@/lib/revalidate-inquiry-dashboard"]);
const fileOf = (base) => [`${base}.ts`, `${base}.tsx`, join(base, "index.ts"), base].find((p) => existsSync(p) && !p.endsWith(base) || (p === base && /\.\w+$/.test(base) && existsSync(p)));

// Lets `node --test` load modules written for Next's bundler: the `@/` alias, extensionless relative imports, and the few that need a network.
registerHooks({
    resolve(specifier, context, next) {
        if (STUBBED.has(specifier))
            return { url: pathToFileURL(STUBS).href, shortCircuit: true };
        const inRepo = context.parentURL?.startsWith("file:") && !context.parentURL.includes("node_modules");
        let base = null;
        if (specifier.startsWith("@/"))
            base = join(ROOT, specifier.slice(2));
        else if (inRepo && specifier.startsWith("."))
            base = join(dirname(fileURLToPath(context.parentURL)), specifier);
        const file = base && fileOf(base);
        if (file)
            return { url: pathToFileURL(file).href, shortCircuit: true };
        if (specifier === "next/server")
            return next("next/server.js", context);
        return next(specifier, context);
    },
});

/** A test with its report fields. Field text must not contain " | ". */
export const kase = (id, fn, purpose, input, expected, body) => test(`${id} | ${fn} | ${purpose} | ${input} | ${expected}`, body);

/** A planned test that can't run here. Reported as BLOCKED with the reason, never as a pass. */
export const blocked = (id, fn, purpose, reason) => test(`${id} | ${fn} | ${purpose} | n/a | n/a`, { skip: `BLOCKED: ${reason}` });
