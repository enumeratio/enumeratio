// Playwright config for the hydration-race check (hydration-race.e2e.ts). Unlike the component
// stories this needs the BUILT site -- the prerendered placeholders only exist in the build --
// so it serves `.vitepress/dist` with `vitepress preview`. Run after `pnpm --filter @enumeratio/web
// run build`:
//
//   pnpm --filter @enumeratio/web run test:hydration

import { defineConfig, devices } from "@playwright/test";

const PORT = 5614;

export default defineConfig({
  testDir: ".",
  testMatch: "*.e2e.ts",
  timeout: 60_000,
  expect: { timeout: 30_000 },
  workers: 1,
  reporter: "list",
  // No service worker: once it controls the page, its requests bypass `page.route`, and the delays below.
  use: { baseURL: `http://localhost:${PORT}`, trace: "retain-on-failure", serviceWorkers: "block" },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: `pnpm exec vitepress preview --port ${PORT}`,
    cwd: "../..",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
