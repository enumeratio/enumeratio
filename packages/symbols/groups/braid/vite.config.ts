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
  // Exhaustive tests: the Lorenz suite runs every necklace up to length 11, and the
  // braid suite every permutation of 1..5.
  test: { testTimeout: 60_000 },
});
