import { worker } from '@electric-sql/pglite/worker'
import { bootPglite } from './boot'

// The browser Web Worker body for the PURE-SQL core: the pglite instance lives HERE, so every query runs off the
// main thread and the UI never blocks. The main thread talks to it through a PGliteWorker proxy (browser.ts
// makeWorkerDb); Web-Locks leader election means multiple tabs share one wasm instance. bootPglite MOUNTS the prebuilt
// dump into an in-memory pglite each boot (loadDataDir) — the DB is a pure calculation engine over the core, so there's
// nothing per-session to persist; the service worker cache-first-serves the dump + pglite wasm so the mount is a
// local-disk read, not a network fetch. (No IndexedDB persistence: the old claim here that it "persists the built DB
// in IndexedDB" was never true.)
worker({
  async init() {
    return bootPglite()
  },
})
