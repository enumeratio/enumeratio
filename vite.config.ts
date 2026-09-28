import { defineConfig } from "vite-plus";
import { FORMAT } from "./packages/entry/src/format.ts";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: { ...FORMAT },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: {
      "vite-plus/prefer-vite-plus-imports": "error",
      // Promote every warning-level rule this repo has actually triggered to an error, so `vp
      // check` (and thus CI and the pre-commit hook, which both run it) fails on a new one
      // instead of letting it accumulate silently.
      "typescript/restrict-template-expressions": "error",
      "unicorn/no-new-array": "error",
      "eslint/no-loss-of-precision": "error",
      "typescript/no-misused-spread": "error",
      "typescript/no-base-to-string": "error",
      "eslint/no-unused-vars": "error",
      "unicorn/no-useless-spread": "error",
    },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
