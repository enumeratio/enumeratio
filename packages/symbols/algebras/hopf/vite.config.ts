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
  // Exhaustive tests: the basis suites run every composition of n up to 7, and both
  // sides of the refinement lattice for each.
  test: { testTimeout: 60_000 },
});
