// Playwright config for the component-story smoke tests (tests/stories/*.spec.ts) -- kept out
// of `vp test` / `pnpm -r run test` / the CI gate (web/vite.config.ts scopes Vitest to
// `*.test.ts`, and these are `*.spec.ts`) because a real browser + the dev server is a
// different, slower kind of check. Run explicitly:
//
//   pnpm --filter @enumeratio/web run test:stories
//
// It starts and stops its own dev server, on a port `vp` doesn't reserve elsewhere.

import { defineConfig, devices } from "@playwright/test";

const PORT = 5613;

export default defineConfig({
  testDir: ".",
  // The first story's page load pays for transforming the whole element + compute-engine tree
  // from source (cold Vite dev transform); later ones reuse that cache and are fast. Generous
  // on purpose so a slow CI runner doesn't fail the smoke test over compile time.
  timeout: 180_000,
  expect: { timeout: 120_000 },
  fullyParallel: false,
  retries: process.env.CI ? 1 : 0,
  reporter: "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "retain-on-failure",
    navigationTimeout: 120_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    // The whole element + compute-engine tree, resolved from source: a cold first page can
    // take a while to transform, hence the long timeouts above and here.
    command: `pnpm exec vitepress dev --port ${PORT}`,
    cwd: "../..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
