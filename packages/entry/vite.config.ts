import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", schema: "src/schema.ts", node: "src/node.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
  },
});
