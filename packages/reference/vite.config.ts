import { defineConfig } from "vite-plus";

export default defineConfig({
  // Most suites start by loading and validating every head's records, several seconds cold on
  // a CI runner.
  test: { testTimeout: 60_000 },
});
