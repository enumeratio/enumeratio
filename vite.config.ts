import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";
import { fmt, lint } from "./packages/config/index.js";

const ceImportBaseline: string[] = JSON.parse(
  readFileSync(new URL("./packages/utils/tests/compute-engine-imports.baseline.json", import.meta.url), "utf8"),
);

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ...fmt,
    // A record's index.md is written by its own writer (@enumeratio/entry's record.ts), and its
    // body holds a head's details as written: markdown formatting would rewrite `*x*` as `_x_`,
    // which the page shows as text. yaml.test holds the files to the writer instead.
    ignorePatterns: ["packages/**/reference/*/index.md", "packages/reference/entries/*/index.md"],
  },
  lint: {
    ...lint,
    overrides: [
      // The nucleus facade (@enumeratio/engine) is the one place a library reaches
      // compute-engine; the full API is `@enumeratio/engine/unstable`. Files that still import it
      // directly are listed in the baseline and exempted below: it may only shrink, and
      // packages/utils/tests/compute-engine-imports.test.ts holds it to that.
      {
        files: ["packages/symbols/**"],
        rules: {
          "no-restricted-imports": [
            "error",
            {
              patterns: [
                {
                  group: ["@cortex-js/compute-engine", "@cortex-js/compute-engine/*"],
                  message: "Import from @enumeratio/engine; the full API is @enumeratio/engine/unstable.",
                },
              ],
            },
          ],
        },
      },
      { files: ["packages/engine/**", "packages/ce-patches/**"], rules: { "no-restricted-imports": "off" } },
      { files: ceImportBaseline, rules: { "no-restricted-imports": "off" } },
    ],
  },
  run: {
    cache: true,
  },
});
