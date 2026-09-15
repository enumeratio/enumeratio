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
  // Exhaustive tests: every statistic is checked over every permutation of 1..6,
  // partition of 0..8, set partition of 1..6 and Dyck path of semilength 0..5. The
  // set-partition crossing/nesting sweeps take ~70s each here and over two minutes on a
  // 2-core CI runner.
  test: { testTimeout: 300_000 },
});
