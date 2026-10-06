import { defineConfig } from "vite-plus";
import { fmt, lint } from "@enumeratio/config";

// web/ is a VitePress site (its own Vite config lives in .vitepress/config.mts),
// not a packed library -- this file exists only so `vp test` has something to run
// Vitest against, for the review-mode backlog parser's unit tests.
export default defineConfig({
  fmt,
  lint,
  test: {
    // Vitest's default include also matches `*.spec.ts`, which is what tests/stories/*.spec.ts
    // (Playwright, its own config and runner -- see tests/stories/playwright.config.ts) uses on
    // purpose, so `vp test` / the CI gate never picks them up.
    include: ["**/*.test.ts"],
  },
});
