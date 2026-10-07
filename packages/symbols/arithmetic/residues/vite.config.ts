import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", notation: "src/notation.ts", table: "src/table.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
  // The exhaustive oracle sweeps outrun vitest's 5 s default on a CI runner.
  test: { testTimeout: 60_000 },
});
