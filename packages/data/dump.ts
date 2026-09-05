// Build a PREBUILT DB dump (gzipped pgdata tar) from the sqlsrc core, for the browser to MOUNT via loadDataDir instead
// of rebuilding — measured ~392ms to mount vs ~2.2s to re-exec (and the single-big-exec path can hang pglite outright).
// Node only (uses pglite on disk); driven by the Vite plugin (vite.ts) at dev-server start / on change, and by prod build.
import { PGlite } from '@electric-sql/pglite'
import { coreBundle, loadCoreAndPacks } from './node.ts'
import { applyPackSegments, orderPacks, segmentByPack } from './sqlsrc-order.ts'
import { bundleHash } from './hash.ts'

/** Build the core (+ any extracted packs), stamp it with the bundle hash (so the client can detect a stale dump),
 *  and return the gzipped tar. */
export async function buildCoreTarGz(): Promise<Uint8Array> {
  const pg = new PGlite()
  await pg.waitReady
  const { core, packs } = loadCoreAndPacks()
  const segments = segmentByPack(orderPacks(core, packs), core, packs) // per-file, dependency order (a giant exec choked)
  await applyPackSegments(segments, async (_label, sql) => { await pg.exec(sql) })
  await pg.exec(`CREATE TABLE _core_version (hash text NOT NULL); INSERT INTO _core_version VALUES ($v$${bundleHash(coreBundle())}$v$)`)
  const blob = (await pg.dumpDataDir('gzip')) as Blob
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await pg.close()
  return bytes
}
