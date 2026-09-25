import { defineConfig } from "vite-plus";

export default defineConfig({
  pack: {
    deps: { resolveDepSubpath: true },
    dts: { generator: "tsgo" },
    // exports managed by hand in package.json so the buildless `./reference`
    // subpath (src-only reference data) survives packing.
    exports: false,
  },
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
  fmt: {},
  // exhaustive permutation-class round-trips reach thousands of elements at n=7–8
  test: { testTimeout: 30_000 },
});
