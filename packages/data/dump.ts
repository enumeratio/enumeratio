// Build a PREBUILT DB dump (gzipped pgdata tar) from the sqlsrc core, for the browser to MOUNT via loadDataDir instead
// of rebuilding — measured ~392ms to mount vs ~2.2s to re-exec (and the single-big-exec path can hang pglite outright).
// Node only (uses pglite on disk); driven by the Vite plugin (vite.ts) at dev-server start / on change, and by prod build.
import { PGlite } from '@electric-sql/pglite'
import { coreFiles, coreBundle } from './node.ts'
import { bundleHash } from './hash.ts'

/** Build the core, stamp it with the bundle hash (so the client can detect a stale dump), and return the gzipped tar. */
export async function buildCoreTarGz(): Promise<Uint8Array> {
  const pg = new PGlite()
  await pg.waitReady
  for (const f of coreFiles()) await pg.exec(f.content) // per-file, in dependency order (a single giant exec choked)
  await pg.exec(`CREATE TABLE _core_version (hash text NOT NULL); INSERT INTO _core_version VALUES ($v$${bundleHash(coreBundle())}$v$)`)
  const blob = (await pg.dumpDataDir('gzip')) as Blob
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await pg.close()
  return bytes
}
