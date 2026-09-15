import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  // Exhaustive tests: the map and tableau suites run every permutation of 1..5
  // through the engine; RSK over S5 alone is a minute's work.
  test: { testTimeout: 300_000 },
});
