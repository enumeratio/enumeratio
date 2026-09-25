import { defineConfig } from "vite-plus";

// web/ is a VitePress site (its own Vite config lives in .vitepress/config.mts),
// not a packed library -- this file exists only so `vp test` has something to run
// Vitest against, for the review-mode backlog parser's unit tests.
export default defineConfig({
  fmt: {},
  lint: {
    options: { typeAware: true, typeCheck: true },
  },
});
