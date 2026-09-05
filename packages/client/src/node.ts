// Node Db providers over the pure-SQL core. TWO flavours:
//   • makeDb()   — MAIN-THREAD, in-process: boot a bare PGlite (zero C) and apply the pg-enumeratio sqlsrc in
//                      dependency order. What the one-shot CLI and the oracle tests use (a blocked query is killed
//                      with Ctrl-C / an external `timeout`); no worker spawn, so cold start is fastest.
//   • makeWorkerDb() — OFF-THREAD: the same pglite lives in a worker_threads worker (node-worker.ts); the host
//                      pairs each query with an id and a WATCHDOG timer. A non-terminating enumeration can't be
//                      `terminate()`d any other way — so long-running / untrusted-size embedders want this one.
import { Worker } from 'node:worker_threads'
import debug from 'debug'
import { bootCore, bundleHash, coreBundle, coreDumpPath } from '@enumeratio/data/node'
import type { Db, Row } from './core'
import { debugGucSetSql, routeNotice } from './debug-env'

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
  // Hand the worker everything it needs to boot self-contained: the dump PATH + the expected hash (mount fast when
  // fresh), and the sqlsrc bundle as the rebuild fallback. The worker reads the dump itself (it has fs) — no
  // cross-package core-loader import, which the spawned tsx context can't resolve for the loader's internals.
  const bundle = coreBundle()
  const boot = { dumpPath: coreDumpPath, expectedHash: bundleHash(bundle), bundle }

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
    async close(): Promise<void> {
      closed = true
      const w = worker
      failAll(new Error('db closed'))
      if (w) await w.terminate()
    },
  }
}
