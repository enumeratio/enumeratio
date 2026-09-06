// Node Db providers over the pure-SQL core. TWO flavours:
//   • makeDb()   — MAIN-THREAD, in-process: boot a bare PGlite (zero C) and apply the pg-enumeratio sqlsrc in
//                      dependency order. What the one-shot CLI and the oracle tests use (a blocked query is killed
//                      with Ctrl-C / an external `timeout`); no worker spawn, so cold start is fastest.
//   • makeWorkerDb() — OFF-THREAD: the same pglite lives in a worker_threads worker (node-worker.ts); the host
//                      pairs each query with an id and a WATCHDOG timer. A non-terminating enumeration can't be
//                      `terminate()`d any other way — so long-running / untrusted-size embedders want this one.
import { Worker } from 'node:worker_threads'
import debug from 'debug'
import { bootCore, coreBundle, coreDumpPath, corePackHashes, coreProfileHash, loadCatalogSnapshotFragments } from '@enumeratio/data/node'
import { buildCatalogSnapshot, mergeCatalogSnapshots } from '@enumeratio/data/catalog-snapshot'
import { runSql, type Db, type Row } from './core'
import { debugGucSetSql, routeNotice } from './debug-env'
import { provideCatalog } from './registry'

// The node entry knows how to find the build-time catalog snapshot FRAGMENTS (#283 phase 4): read each
// `catalog-snapshot.<pack>.json` off disk and merge them in the SAME load order corePackHashes() already
// establishes (core first, then packs in `requires-pack` order — see catalog-snapshot.ts's mergeCatalogSnapshots
// for the shadowing/metadata-precedence rule that order implies). The browser entry can't do this fs read — it
// uses import.meta.glob instead. Neither can do the other's trick, which is why the registry takes a source
// rather than importing one.
//
// A fragment is "fresh" when its OWN hash (hash.ts packHashes — not a whole-profile hash) matches that pack's
// live hash. When ANY pack this profile loads has no fragment, or a stale one, BUILD THE WHOLE SNAPSHOT LIVE
// rather than decline (#281, preserved across the split): buildCatalogSnapshot has no pack-scoping to rebuild
// just the stale pack, and a correct whole rebuild beats a per-pack one that silently gets pack boundaries wrong
// — the same call bootCore() already makes for the pgdata dump. The snapshot is a generated release artifact, so
// its hash goes stale on every sqlsrc edit — and a stale/incomplete fragment set makes the registry unusable,
// which sends every expression to pg. That is the correct answer for the browser, which has no database to ask;
// it is the wrong one here, where the core has already been booted and the catalog is one pass away. Before
// #281, `calc 'binomial(30, 15)'` reported engine=pg on any working tree with an uncommitted sqlsrc change — i.e.
// the ts fast path was unreachable in development, which is precisely where it is being developed.
//
// Same call the tests and selfcerts already use, so this path is the one they certify.
const catalogLog = debug('enumeratio:client:catalog')
provideCatalog(async () => {
  const liveHash = coreProfileHash()
  const packHashes = corePackHashes()
  const fragments = await loadCatalogSnapshotFragments()
  const stale = packHashes.filter(({ pack, hash }) => fragments.get(pack)?.hash !== hash).map(({ pack }) => pack)
  if (stale.length === 0) {
    catalogLog('catalog snapshot: merged %d fresh pack fragment(s)', packHashes.length)
    const merged = mergeCatalogSnapshots(packHashes.map(({ pack }) => fragments.get(pack)!))
    return { snapshot: { ...merged, hash: liveHash }, liveHash }
  }
  catalogLog('catalog snapshot: rebuilding live — missing/stale fragment(s): %s', stale.join(', '))
  return { snapshot: await buildCatalogSnapshot(runSql, liveHash), liveHash }
})

const log = debug('enumeratio:client:db')

export async function makeDb(): Promise<Db> {
  const t0 = Date.now()
  const pg = await bootCore()   // mount the prebuilt dump when fresh, else rebuild from sqlsrc (bootCore self-heals)
  const setSql = debugGucSetSql()   // lift DEBUG (if it names an enumeratio: namespace) into the session GUC
  if (setSql) await pg.exec(setSql)
  log('makeDb ready in %dms', Date.now() - t0)
  return {
    query: <T>(sql: string, params?: unknown[]) =>
      pg.query<T>(sql, params as never, { onNotice: routeNotice }) as Promise<{ rows: T[] }>,
    close: () => pg.close(),
  }
}

const DEFAULT_TIMEOUT_MS = 30_000
let timeoutMs = Number(process.env.ENUMERATIO_QUERY_TIMEOUT_MS ?? DEFAULT_TIMEOUT_MS)

/** Per-query watchdog timeout in ms for makeWorkerDb; 0 disables it (let a long dump run). */
export function setQueryTimeout(ms: number): void {
  timeoutMs = ms
}

type Reply = { id: number; rows?: unknown[]; error?: string; notices?: string[] }
type Pending = { resolve: (v: { rows: unknown[] }) => void; reject: (e: Error) => void; timer: ReturnType<typeof setTimeout> | null }

/** Worker-backed Db with a watchdog: one worker_threads worker owns the pglite; a query that outlives the timeout
 *  is rejected and the worker terminated, and the next query lazily respawns. */
export function makeWorkerDb(): Db {
  let worker: Worker | null = null
  let closed = false   // a fire-and-forget query (the printer prime) must not respawn a worker past close()
  let seq = 0
  const pending = new Map<number, Pending>()
  // Hand the worker everything it needs to boot self-contained: the dump PATH + the expected PER-PACK hashes
  // (mount fast when every pack is fresh), and the sqlsrc bundle as the rebuild fallback. The worker reads the
  // dump itself (it has fs) — no cross-package core-loader import, which the spawned tsx context can't resolve
  // for the loader's internals.
  const bundle = coreBundle()
  const boot = { dumpPath: coreDumpPath, expectedPackHashes: corePackHashes(), bundle }

  function failAll(err: Error) {
    for (const p of pending.values()) {
      if (p.timer) clearTimeout(p.timer)
      p.reject(err)
    }
    pending.clear()
    worker = null // respawn on next query
  }

  function spawn(): Worker {
    log('spawning worker')
    // run the TS worker body under tsx (the parent may be tsx or vitest — either way the worker self-loads)
    const w = new Worker(new URL('./node-worker.ts', import.meta.url), { execArgv: ['--import', 'tsx'], workerData: boot })
    w.on('message', (m: Reply) => {
      for (const message of m.notices ?? []) routeNotice({ message }) // #204: notices ride the reply as data, not a live callback
      const p = pending.get(m.id)
      if (!p) return
      pending.delete(m.id)
      if (p.timer) clearTimeout(p.timer)
      if (m.error) p.reject(new Error(m.error))
      else p.resolve({ rows: m.rows ?? [] })
    })
    // a stale worker (already replaced by the watchdog / a respawn) must not touch shared state
    w.on('error', (e) => {
      if (worker === w) failAll(e instanceof Error ? e : new Error(String(e)))
    })
    w.on('exit', (code) => {
      if (worker === w && pending.size) failAll(new Error(`enumeratio worker exited (code ${code})`))
    })
    return w
  }

  return {
    query<T = Row>(sql: string, params: unknown[] = []): Promise<{ rows: T[] }> {
      if (closed) return Promise.reject(new Error('db closed'))
      if (!worker) worker = spawn()
      const w = worker
      const id = ++seq
      return new Promise<{ rows: T[] }>((resolve, reject) => {
        const timer =
          timeoutMs > 0
            ? setTimeout(() => {
                log('watchdog fired after %dms — terminating worker', timeoutMs)
                pending.delete(id)
                reject(new Error(`enumeratio: query exceeded ${timeoutMs}ms watchdog — terminating worker`))
                void w.terminate()
                if (worker === w) failAll(new Error('worker terminated by watchdog'))
              }, timeoutMs)
            : null
        pending.set(id, { resolve: resolve as Pending['resolve'], reject, timer })
        w.postMessage({ id, sql, params })
      })
    },
    /** Interrupt without closing: terminate the worker (the ONLY way to stop a non-terminating enumeration — a
     *  tight plpgsql loop ignores statement_timeout) and let the next query respawn a fresh one. */
    async cancel(): Promise<void> {
      const w = worker
      if (!w) return
      log('cancel — terminating worker')
      failAll(new Error('enumeratio: query cancelled'))
      await w.terminate()
    },
    async close(): Promise<void> {
      closed = true
      const w = worker
      failAll(new Error('db closed'))
      if (w) await w.terminate()
    },
  }
}
