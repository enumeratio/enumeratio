import { defineConfig } from "vite-plus";
import { FORMAT } from "./packages/entry/src/format.ts";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: { ...FORMAT },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    // Everything oxlint enables by default is `correctness`; as errors, a new finding fails
    // `vp check`, and so CI and the pre-commit hook, instead of piling up as a warning.
    categories: { correctness: "error" },
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
