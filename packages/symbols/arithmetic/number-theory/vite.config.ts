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
  fmt: {},
  // The exhaustive oracle sweeps outrun vitest's 5 s default on a CI runner.
  test: { testTimeout: 60_000 },
});
