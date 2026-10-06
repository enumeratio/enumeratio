import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", render: "src/render/index.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint,
  fmt,
});
