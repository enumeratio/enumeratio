// Build a PREBUILT DB dump (gzipped pgdata tar) from the sqlsrc core, for the browser to MOUNT via loadDataDir instead
// of rebuilding — measured ~392ms to mount vs ~2.2s to re-exec (and the single-big-exec path can hang pglite outright).
// Node only (uses pglite on disk); driven by the Vite plugin (vite.ts) at dev-server start / on change, and by prod build.
//
// #283 phase 4 (wiki Core-And-Packs §7): ONE DUMP PER PROFILE — 'core' (just core, no packs) or 'all' (core +
// every extracted pack) — not one per pack (that's 2^N). A pack outside the mounted profile is applied by exec
// against an already-mounted profile instead (~1s per ~30 files), which this file has no opinion on — it only
// builds the two whole-profile dumps.
import { PGlite } from '@electric-sql/pglite'
import { loadCoreAndPacks } from './node.ts'
import { applyPackSegments, orderPacks, segmentByPack } from './sqlsrc-order.ts'
import { bundleHash, packHashes } from './hash.ts'

export type Profile = 'core' | 'all'

/** Build one PROFILE's dump, stamped with a per-pack hash (`_pack_version`, one row per loaded pack — #283 phase
 *  1.4, wiki §7) so the client can detect exactly which pack(s) went stale, and return the gzipped tar. */
export async function buildProfileTarGz(profile: Profile): Promise<Uint8Array> {
  const { core, packs: allPacks } = loadCoreAndPacks()
  const packs = profile === 'all' ? allPacks : []
  const pg = new PGlite()
  await pg.waitReady
  const ordered = orderPacks(core, packs)
  const segments = segmentByPack(ordered, core, packs)
  await applyPackSegments(segments, async (_label, sql) => { await pg.exec(sql) })
  const hashes = packHashes(segments)
  const rows = hashes.map(h => `($p$${h.pack}$p$, $v$${h.hash}$v$)`).join(', ')
  const bundle = ordered.map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')
  await pg.exec(`
    CREATE TABLE _pack_version (pack text NOT NULL, hash text NOT NULL);
    INSERT INTO _pack_version VALUES ${rows};
    -- compat: the pre-#283-phase-1.4 whole-bundle hash in its old single-row shape, for any reader still on it.
    -- Computed over THIS profile's own bundle, so a 'core' dump's compat row and an 'all' dump's compat row
    -- legitimately differ — there is no single "the" bundle hash once there is more than one profile.
    CREATE TABLE _core_version (hash text NOT NULL);
    INSERT INTO _core_version VALUES ($v$${bundleHash(bundle)}$v$);
  `)
  const blob = (await pg.dumpDataDir('gzip')) as Blob
  const bytes = new Uint8Array(await blob.arrayBuffer())
  await pg.close()
  return bytes
}
