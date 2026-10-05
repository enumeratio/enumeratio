import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", notation: "src/notation.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  // The root config's width, so `vp check` agrees with it from here and from a repository of its own.
  fmt: { printWidth: 120 },
  // Exhaustive tests: the basis suites run every composition of n up to 7, and both
  // sides of the refinement lattice for each.
  test: { testTimeout: 60_000 },
});
