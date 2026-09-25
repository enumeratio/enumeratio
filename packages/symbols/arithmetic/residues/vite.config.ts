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
  // The exhaustive oracle sweeps outrun vitest's 5 s default on a CI runner.
  test: { testTimeout: 60_000 },
});
