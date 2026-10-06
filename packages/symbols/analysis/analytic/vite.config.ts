import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      notation: "src/notation.ts",
      definitions: "src/definitions.ts",
      shader: "src/shader.ts",
    },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
  // the definition-agreement sweeps run well past vitest's 5s on a loaded 2-core runner
  test: { testTimeout: 60_000 },
});
