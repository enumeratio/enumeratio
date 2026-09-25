import { defineConfig } from "vite-plus";

export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  fmt: {
    // Reference records have one writer, @enumeratio/entry's stringifyYaml, and a test that
    // every file is its output (packages/reference/tests/shims.test.ts).
    ignorePatterns: ["packages/**/reference/*.yaml", "packages/reference/entries/*.yaml"],
  },
  lint: {
    jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
    rules: { "vite-plus/prefer-vite-plus-imports": "error" },
    options: { typeAware: true, typeCheck: true },
  },
  run: {
    cache: true,
  },
});
