import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";
import { configDefaults } from "vite-plus/test/config";
import smoke from "./smoke-skip.json" with { type: "json" };

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
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
    // exports are managed by hand in package.json
    exports: false,
  },
  lint,
  fmt,
  // the map/tableau suites' exhaustive checks (RSK over S5, etc.) set the floor;
  // collections' permutation-class round-trips fit well inside it.
  test: {
    testTimeout: 300_000,
    // SMOKE_TESTS=1 (PR and main CI) leaves out the files that cost 25 s or more; the nightly runs them all.
    exclude: process.env.SMOKE_TESTS
      ? [...configDefaults.exclude, ...smoke.skip.map((f) => `**/${f}`)]
      : configDefaults.exclude,
  },
});
