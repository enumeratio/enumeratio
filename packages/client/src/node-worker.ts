import { readFile } from 'node:fs/promises'
import { parentPort, workerData } from 'node:worker_threads'
import { PGlite } from '@electric-sql/pglite'
import { debugGucSetSql } from './debug-env.ts'

// The node worker body for the PURE-SQL core. Boot self-contained (no cross-package core-loader import, which the
// spawned tsx context can't resolve for the loader's internals): MOUNT the prebuilt dump handed over via
// workerData when every pack's stamped hash (`_pack_version`) matches the live sqlsrc, else re-exec the sqlsrc
// BUNDLE. Then answer {id,sql,params} messages with {id,rows} or {id,error}. A never-returning query simply never
// replies — the host's watchdog (node.ts makeWorkerDb) terminates the whole worker.
type PackHash = { pack: string; hash: string }
type Boot = { dumpPath: string; expectedPackHashes: PackHash[]; bundle: string }

// Local, self-contained mirror of hash.ts's stalePacks (this worker can't cross-package-import the loader's
// internals — see the comment above): packs whose stamped hash differs from the live expected hash.
function stalePacks(stored: PackHash[], live: PackHash[]): string[] {
  const s = new Map(stored.map(r => [r.pack, r.hash]))
  const l = new Map(live.map(r => [r.pack, r.hash]))
  const names = new Set([...s.keys(), ...l.keys()])
  return [...names].filter(n => s.get(n) !== l.get(n)).sort()
}

const ready = (async () => {
  const { dumpPath, expectedPackHashes, bundle } = workerData as Boot
  try {
    const bytes = await readFile(dumpPath)
    const pg = new PGlite({ loadDataDir: new Blob([bytes]) })
    await pg.waitReady
    const r = await pg.query<PackHash>('SELECT pack, hash FROM _pack_version').catch(() => ({ rows: [] as PackHash[] }))
    const stale = stalePacks(r.rows, expectedPackHashes)
    if (r.rows.length > 0 && stale.length === 0) return withDebug(pg)   // every pack fresh → fast mount
    await pg.close()                                                     // stale/missing → rebuild below
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
