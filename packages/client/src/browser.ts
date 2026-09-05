// Browser Db providers over the pure-SQL core (the pg-enumeratio sqlsrc, Vite-inlined as coreBundle — browser-only;
// node uses node.ts's disk loader). TWO flavours:
//   • makeDb()   — MAIN-THREAD: a bare PGlite in the page. Fine for small/embedded queries (e.g. a docs widget
//                      with its own line cap); a big enumeration would block the UI.
//   • makeWorkerDb() — OFF-THREAD: the pglite lives in a Web Worker (browser-worker.ts), proxied by pglite's
//                      PGliteWorker, so calculation never blocks the main thread. What the explorer uses.
import { bootPglite } from './boot'
import { setDebug, type Db, type Row } from './core'
import { routeNotice } from './debug-env'

// Log query failures with their Postgres context whenever running a local dev build (Vite import.meta.env.DEV) — the
// "always debug locally" default. Prod builds stay quiet; setDebug()/?debug/localStorage still override either way.
try { if ((import.meta as unknown as { env?: { DEV?: boolean } }).env?.DEV) setDebug(true) } catch { /* no import.meta.env */ }

export async function makeDb(): Promise<Db> {
  const pg = await bootPglite()
  return {
    query: <T>(sql: string, params?: unknown[]) =>
      pg.query<T>(sql, params as never, { onNotice: routeNotice }) as Promise<{ rows: T[] }>,
    close: () => pg.close(),
  }
}

export async function makeWorkerDb(): Promise<Db> {
  const { PGliteWorker } = await import('@electric-sql/pglite/worker')
  const w = new PGliteWorker(new Worker(new URL('./browser-worker.ts', import.meta.url), { type: 'module' }))
  await w.waitReady
  return {
    // #204: confirmed (read the compiled @electric-sql/pglite/dist/worker/index.cjs, not guessed) that this onNotice
    // is a no-op — PGliteWorker's execProtocol/execProtocolStream overrides take only the raw wire message, and its
    // internal "rpc-call" postMessage bridge to the leader tab forwards no options object at all, so there is no
    // channel for a notice callback (or the reply-envelope trick node-worker.ts uses — that protocol is owned by
    // the library, not ours to extend) to cross this boundary. A gated RAISE NOTICE from a query run through the
    // worker goes nowhere. Closing this needs either an upstream PGliteWorker feature, or moving worker-side debug
    // signalling onto NOTIFY/onNotification (which IS forwarded) instead of RAISE NOTICE — both out of scope here
    // and unverified without a real browser; left as a known gap rather than a guess.
    query: <T = Row>(sql: string, params?: unknown[]) =>
      w.query<T>(sql, params as never, { onNotice: routeNotice }) as Promise<{ rows: T[] }>,
    close: () => w.close(),
  }
}

/** No-op in the browser (the tab just closes); present so the API matches the node entry's watchdog control. */
export function setQueryTimeout(_ms: number): void {}
