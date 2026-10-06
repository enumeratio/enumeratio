import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    entry: {
      index: "src/index.ts",
      compiled: "src/compiled.ts",
      testing: "src/testing.ts",
      unstable: "src/unstable.ts",
      "unstable-latex-syntax": "src/unstable-latex-syntax.ts",
    },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
});
