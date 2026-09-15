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
  // Exhaustive tests: the basis suites run every composition of n up to 7, and both
  // sides of the refinement lattice for each.
  test: { testTimeout: 60_000 },
});
