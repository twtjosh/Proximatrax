import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // New in eslint-config-next 16.3: flags existing effects that sync state; a render cost, not a bug. Warn until they are reworked.
    rules: { "react-hooks/set-state-in-effect": "warn" },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Private, gitignored scripts; not part of the app.
    "internal/**",
    ".claude/**",
    ".cursor/**",
  ]),
]);

export default eslintConfig;
