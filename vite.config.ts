import { defineConfig } from "vite-plus";
import { FORMAT } from "./packages/entry/src/format.ts";

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
  },
  run: {
    cache: true,
  },
});
