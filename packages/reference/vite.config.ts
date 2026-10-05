import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", node: "src/node.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  // Most suites start by loading and validating every head's records, several seconds cold on
  // a CI runner.
  test: { testTimeout: 60_000 },
});
