// Boot a browser PGlite over the pure-SQL core, FAST.
//
// Rebuilding the core from sqlsrc on every load is the multi-second cost (and a single giant exec can hang pglite). So
// when a prebuilt dump is available — served by @enumeratio/data's Vite plugin at the URL it `define`s as
// __ENUMERATIO_CORE_TAR__ — we MOUNT it (loadDataDir, ~400ms) instead. A bundle-hash version check makes a stale or
// absent dump safe: on any miss we fall back to building from sqlsrc, per-file (never one giant exec).
import { PGlite } from '@electric-sql/pglite'
import { coreFiles, corePackHashes, stalePacks, type PackHash } from '@enumeratio/data'
import { debugGucSetSql } from './debug-env'

declare const __ENUMERATIO_CORE_TAR__: string | undefined

async function buildFromSource(): Promise<PGlite> {
  const pg = new PGlite()
  await pg.waitReady
  for (const sql of Object.values(coreFiles)) await pg.exec(sql) // dependency-ordered; per-file (a single big exec choked)
  return pg
}

// Lift DEBUG (from localStorage.debug — see debug-env.ts) into the session GUC once, right after boot, whichever
// path got us a ready pglite — the fast tar-mount or the from-source rebuild.
async function withDebugLift(pg: PGlite): Promise<PGlite> {
  const setSql = debugGucSetSql()
  if (setSql) await pg.exec(setSql)
  return pg
}

export async function bootPglite(): Promise<PGlite> {
  const tarUrl = typeof __ENUMERATIO_CORE_TAR__ !== 'undefined' ? __ENUMERATIO_CORE_TAR__ : null
  if (tarUrl) {
    try {
      const resp = await fetch(tarUrl)
      if (resp.ok) {
        const pg = new PGlite({ loadDataDir: await resp.blob() })
        await pg.waitReady
        const r = await pg
          .query<PackHash>('SELECT pack, hash FROM _pack_version')
          .catch(() => ({ rows: [] as PackHash[] }))
        const stale = stalePacks(r.rows, corePackHashes)
        if (r.rows.length > 0 && stale.length === 0) return withDebugLift(pg) // every pack fresh → the fast path (~1s mount vs a full rebuild)
        await pg.close() // stale/missing dump → rebuild from source below
      }
    } catch {
      /* dump unavailable / failed to mount → build from source */
    }
  }
  return withDebugLift(await buildFromSource())
}
