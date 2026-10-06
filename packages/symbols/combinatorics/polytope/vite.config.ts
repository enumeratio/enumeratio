import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
  // Exhaustive tests: every face of the permutahedron is enumerated, and the poset
  // order checked pairwise (transitivity, triplewise).
  test: { testTimeout: 60_000 },
});
