import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", notation: "src/notation.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
  // Exhaustive tests: the Hecke relations are checked over every permutation of 1..4,
  // pairwise in places.
  test: { testTimeout: 60_000 },
});
