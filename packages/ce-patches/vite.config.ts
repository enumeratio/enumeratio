import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", "wgsl-complex": "src/compute-engine/compilation/wgsl-complex.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  test: {
    // The registry is built from src/patches/*.ts, so a test run writes it first.
    globalSetup: ["scripts/global-setup.ts"],
  },
});
