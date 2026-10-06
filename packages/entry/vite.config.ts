import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  fmt,
  lint,
  pack: {
    entry: { index: "src/index.ts", schema: "src/schema.ts", node: "src/node.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
});
