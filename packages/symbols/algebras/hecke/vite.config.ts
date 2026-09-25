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
  // Exhaustive tests: the Hecke relations are checked over every permutation of 1..4,
  // pairwise in places.
  test: { testTimeout: 60_000 },
});
