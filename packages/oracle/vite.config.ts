import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", bounded: "src/bounded.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo", tsconfig: "tsconfig.dts.json" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
});
