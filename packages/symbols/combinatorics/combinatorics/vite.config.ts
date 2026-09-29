import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: {
      collections: "collections/src/index.ts",
      domains: "domains/src/index.ts",
    },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
    // exports managed by hand in package.json so the buildless `./*/reference`
    // and `./collections/sampleable` subpaths (src-only) survive packing.
    exports: false,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  // domains' exhaustive map/tableau suites (RSK over S5, etc.) set the floor;
  // collections' permutation-class round-trips fit well inside it.
  test: { testTimeout: 300_000 },
});
