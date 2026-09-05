import { defineConfig } from 'vitest/config'

// Booting pglite in a worker + running sage takes real time; give hooks and tests generous room.
//
// dangerouslyIgnoreUnhandledErrors: the suites boot pglite (heavy sync-wasm) and spawn worker_threads + child CLI
// processes; on teardown vitest intermittently throws its own internal RPC error `[vitest-worker]: Timeout calling
// "onTaskUpdate"` and reports it as an unhandled error, failing the run with exit 1 even though every test passes.
// Not a test/app error — reproduced with main-thread makeDb, off-thread makeWorkerDb, and the forks pool, and still
// present on the current latest vitest (3.2.7, whole monorepo aligned). Ignore unhandled errors here so the exit
// code tracks the actual results; revisit on a future vitest release.
export default defineConfig({
  test: { testTimeout: 180_000, hookTimeout: 180_000, dangerouslyIgnoreUnhandledErrors: true },
})
