import { defineConfig } from 'vitest/config'

// Same posture as packages/cli's config: these suites boot pglite (heavy sync-wasm) and, for the engine tests,
// worker_threads on top of it, so hooks and tests need generous room. `dangerouslyIgnoreUnhandledErrors` is the
// same #14-shaped workaround the cli config documents — vitest intermittently throws its own internal
// `[vitest-worker]: Timeout calling "onTaskUpdate"` on teardown and fails an otherwise-green run.
export default defineConfig({
  test: { testTimeout: 180_000, hookTimeout: 180_000, dangerouslyIgnoreUnhandledErrors: true },
})
