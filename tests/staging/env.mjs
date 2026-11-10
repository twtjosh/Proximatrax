// Loads .env.staging and refuses to continue if it could reach production.
import { readFileSync } from "node:fs";
import { join } from "node:path";

const ROOT = join(import.meta.dirname, "../..");
function parse(file) {
    const out = {};
    for (const line of readFileSync(join(ROOT, file), "utf8").replace(/^﻿/, "").split(/\r?\n/)) {
        const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*?)\s*$/);
        if (m)
            out[m[1]] = m[2].replace(/^['"]|['"]$/g, "");
    }
    return out;
}

export const staging = parse(".env.staging");
const production = parse(".env.local");
for (const key of ["NEXT_PUBLIC_SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "SUPABASE_SERVICE_ROLE_KEY"]) {
    if (!staging[key])
        throw new Error(`${key} is missing from .env.staging`);
    if (staging[key] === production[key])
        throw new Error(`${key} in .env.staging matches .env.local. Refusing to run against production.`);
}
if (!staging.TEST_PASSWORD)
    throw new Error("TEST_PASSWORD is missing from .env.staging");

export const email = (who) => `${who}@proximatrax-test.com`;
