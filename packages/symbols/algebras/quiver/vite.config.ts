import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    entry: { index: "src/index.ts", notation: "src/notation.ts" },
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  // The root config's width, so `vp check` agrees with it from here and from a repository of its own.
  fmt: { printWidth: 120 },
});
