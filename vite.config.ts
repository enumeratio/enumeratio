import { readFileSync } from "node:fs";
import { defineConfig } from "vite-plus";
import { FORMAT } from "./packages/entry/src/format.ts";

const ceImportBaseline: string[] = JSON.parse(
  readFileSync(new URL("./packages/utils/tests/compute-engine-imports.baseline.json", import.meta.url), "utf8"),
);

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    ...FORMAT,
    // A record's index.md is written by its own writer (@enumeratio/entry's record.ts), and its
    // body holds a head's details as written: markdown formatting would rewrite `*x*` as `_x_`,
    // which the page shows as text. yaml.test holds the files to the writer instead.
    ignorePatterns: ["packages/**/reference/*/index.md", "packages/reference/entries/*/index.md"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    // Everything oxlint enables by default is `correctness`; as errors, a new finding fails
    // `vp check`, and so CI and the pre-commit hook, instead of piling up as a warning.
    categories: { correctness: "error" },
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // `new Array(n).fill(x)` is about ten times faster than `Array.from({ length: n }, …)`,
      // and the collection kernels allocate in hot loops; its one-argument ambiguity is moot
      // with `.fill`.
      "unicorn/no-new-array": "off",
      "typescript/consistent-return": "error",
      "unicorn/no-array-sort": "error",
      "unicorn/no-array-reverse": "error",
    },
    options: { typeAware: true, typeCheck: true },
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
