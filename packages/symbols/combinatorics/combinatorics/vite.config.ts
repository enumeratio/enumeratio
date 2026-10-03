import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      collections: "collections/src/index.ts",
      notation: "src/notation.ts",
      findstat: "findstat/src/findstat-data.ts",
      sampleable: "collections/scripts/sampleable.ts",
    },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
    // exports are managed by hand in package.json
    exports: false,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  // the map/tableau suites' exhaustive checks (RSK over S5, etc.) set the floor;
  // collections' permutation-class round-trips fit well inside it.
  test: { testTimeout: 300_000 },
});
