// Shared `vp check` settings: a package's vite.config.ts spreads `fmt` and `lint`, so it checks the
// same way in the monorepo and from a repository of its own. Plain JS, so a config can load it
// without a build step.

/** Oxfmt options; the record writer in @enumeratio/entry holds the same width (a test keeps them equal). */
export const fmt = {
  printWidth: 120,
  // A record's index.md is written by that writer; formatting would rewrite its body.
  ignorePatterns: ["reference/*/index.md"],
};

/** Oxlint options; the root adds its path-scoped `overrides`. */
export const lint = {
  jsPlugins: [{ name: "vite-plus", specifier: "vite-plus/oxlint-plugin" }],
  // Everything oxlint enables by default is `correctness`; as errors, a new finding fails
  // `vp check`, and so CI and the pre-commit hook, instead of piling up as a warning.
  categories: { correctness: "error" },
  rules: {
    "vite-plus/prefer-vite-plus-imports": "error",
    // `new Array(n).fill(x)` is about ten times faster than `Array.from({ length: n }, …)`,
    // and the collection kernels allocate in hot loops; its one-argument ambiguity is moot
    // with `.fill`.
    "unicorn/no-new-array": "off",
    "typescript/consistent-return": "error",
    "unicorn/no-array-sort": "error",
    "unicorn/no-array-reverse": "error",
  },
  options: { typeAware: true, typeCheck: true },
};
