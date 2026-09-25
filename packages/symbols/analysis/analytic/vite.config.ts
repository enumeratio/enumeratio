import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  // the definition-agreement sweeps run well past vitest's 5s on a loaded 2-core runner
  test: { testTimeout: 60_000 },
});
