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
  // Exhaustive tests: every face of the permutahedron is enumerated, and the poset
  // order checked pairwise (transitivity, triplewise).
  test: { testTimeout: 60_000 },
});
