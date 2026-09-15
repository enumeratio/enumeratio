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
  // Exhaustive tests: the diagram bases are enumerated by brute force over every set
  // partition of 2n points.
  test: { testTimeout: 60_000 },
});
