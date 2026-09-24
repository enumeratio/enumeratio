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
  // The permutation-family exhaustive round-trips (ConnectedPermutations, AlternatingPermutations,
  // the pattern avoiders) run into the thousands of elements at n=7-8; comfortably under the default
  // timeout individually, but generous headroom here matches the convention sibling packages use for
  // their own exhaustive suites.
  test: { testTimeout: 30_000 },
});
