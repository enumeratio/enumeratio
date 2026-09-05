import { readFile } from 'node:fs/promises'
import { parentPort, workerData } from 'node:worker_threads'
import { PGlite } from '@electric-sql/pglite'
import { debugGucSetSql } from './debug-env.ts'

// The node worker body for the PURE-SQL core. Boot self-contained (no cross-package core-loader import, which the
// spawned tsx context can't resolve for the loader's internals): MOUNT the prebuilt dump handed over via
// workerData when its stamped hash matches the live sqlsrc, else re-exec the sqlsrc BUNDLE. Then answer
// {id,sql,params} messages with {id,rows} or {id,error}. A never-returning query simply never replies — the
// host's watchdog (node.ts makeWorkerDb) terminates the whole worker.
type Boot = { dumpPath: string; expectedHash: string; bundle: string }
const ready = (async () => {
  const { dumpPath, expectedHash, bundle } = workerData as Boot
  try {
    const bytes = await readFile(dumpPath)
    const pg = new PGlite({ loadDataDir: new Blob([bytes]) })
    await pg.waitReady
    const r = await pg.query<{ hash: string }>('SELECT hash FROM _core_version LIMIT 1').catch(() => ({ rows: [] as { hash: string }[] }))
    if (r.rows[0]?.hash === expectedHash) return withDebug(pg)   // fresh dump → fast mount
    await pg.close()                                              // stale → rebuild below
  } catch {
    /* dump absent / mount failed → build from source */
  }
  const pg = new PGlite()
  await pg.waitReady
  await pg.exec(bundle)
  return withDebug(pg)
})()

async function withDebug(pg: PGlite): Promise<PGlite> {
  const setSql = debugGucSetSql()   // worker_threads inherit process.env by default, so DEBUG is visible here too
  if (setSql) await pg.exec(setSql)
  return pg
}

// #204: forward pglite NOTICEs to the host as DATA, not a live cross-thread callback — a per-query `onNotice`
// passed IN from the host (a function crossing postMessage) hung the worker teardown (#14) and was reverted. This
// callback stays entirely local to the worker: pglite has no constructor-level onNotice (only per-call), so it's
// defined once here and handed to every query, buffering into `notices` until the reply flushes it.
let notices: string[] = []
const onNotice = (n: { message?: string }) => { notices.push(n.message ?? '') }

parentPort!.on('message', async (m: { id: number; sql: string; params?: unknown[] }) => {
  notices = []
  try {
    const pg = await ready
    const res = await pg.query(m.sql, m.params, { onNotice })
    parentPort!.postMessage({ id: m.id, rows: res.rows, notices })
  } catch (e) {
    parentPort!.postMessage({ id: m.id, error: e instanceof Error ? e.message : String(e), notices })
  }
})
