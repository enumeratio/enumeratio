// Node entry for the pure-SQL core: read the sqlsrc files from DISK and order them by their `-- requires:`
// headers — the same toposort the Vite bundle (index.ts) and run.mts use, but without import.meta.glob (which
// only exists under a bundler). Consumers that run in node (the CLI, tests) load the core through this.
import { readFile } from 'node:fs/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { applyPackSegments, orderPacks, segmentByPack, type Pack, type SqlFile } from './sqlsrc-order.ts'
import { readPacksFromDisk } from './pack-loader.ts'
import { bundleHash, packHashes, profileHash, stalePacks, type PackHash } from './hash.ts'
import type { CatalogSnapshot } from './catalog-snapshot.ts'
export type { CatalogSnapshot } from './catalog-snapshot.ts'
export { bundleHash, stalePacks, type PackHash } from './hash.ts'   // so a consumer can hash a bundle it already read, without a second read

const here = dirname(fileURLToPath(import.meta.url))
export const sqlsrcDir = join(here, 'sqlsrc')
export const packsDir = join(here, 'packs')

/** The prebuilt gzipped-tar dump (built by build-pgdata.mts / the client build). Mounted by bootCore(). */
export const coreDumpPath = join(here, 'enumeratio-core.pgdata')

/** The per-pack catalog-snapshot fragment (#283 phase 4): `catalog-snapshot.<pack>.json`, built by
 *  build-catalog-snapshot.mts alongside the dump — same lifecycle, gitignored release artifact. */
export function catalogSnapshotFragmentPath(pack: string): string {
  return join(here, `catalog-snapshot.${pack}.json`)
}

/** Every pack-fragment snapshot that exists on disk, keyed by pack id. A fragment missing entirely (never built,
 *  or a pack extracted since) simply isn't in the map — never throws; an absent or incomplete set degrades to
 *  "the caller rebuilds live" (client/node.ts), same as a missing single blob did before the split. */
export async function loadCatalogSnapshotFragments(): Promise<Map<string, CatalogSnapshot>> {
  const out = new Map<string, CatalogSnapshot>()
  for (const { pack } of corePackHashes()) {
    try {
      out.set(pack, JSON.parse(await readFile(catalogSnapshotFragmentPath(pack), 'utf8')) as CatalogSnapshot)
    } catch {
      /* this pack's fragment is missing/unreadable — the caller decides whether that forces a rebuild */
    }
  }
  return out
}

/** Core, read from disk, as a `Pack` (name 'core', no requiresPack — it's always the implicit dependency). */
export function corePack(): Pack {
  return {
    name: 'core',
    requiresPack: [],
    files: readdirSync(sqlsrcDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(sqlsrcDir, f), 'utf8') })),
  }
}

/** Core + every extracted pack under `packs/*`, both read from disk (#283 phase 1.2). */
export function loadCoreAndPacks(): { core: Pack; packs: Pack[] } {
  return { core: corePack(), packs: readPacksFromDisk(packsDir) }
}

/** The ordered files (bootstrap first, then any extracted packs in `requires-pack` order), read from disk. With
 *  zero packs under `packs/*` (today) this is byte-identical to `orderSqlsrc(sqlsrc/*)` — see sqlsrc-order.test.ts. */
export function coreFiles(): SqlFile[] {
  const { core, packs } = loadCoreAndPacks()
  return orderPacks(core, packs)
}

/** The whole core (+ packs) as one concatenated bundle, dependency-ordered. */
export function coreBundle(): string {
  return coreFiles().map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')
}

/** Content hash of the current sqlsrc bundle. Matches index.ts's coreBundleHash — the value stamped into a dump. */
export function coreBundleHash(): string {
  return bundleHash(coreBundle())
}

/** Per-pack hashes for the CURRENT core+packs on disk, in profile order (core first, §7). One row per loaded
 *  pack — with zero packs extracted (today) this is a single 'core' row whose hash equals coreBundleHash(). */
export function corePackHashes(): PackHash[] {
  const { core, packs } = loadCoreAndPacks()
  return packHashes(segmentByPack(orderPacks(core, packs), core, packs))
}

/** The profile hash (§7): hash of the ordered per-pack hashes for the current core+packs. Distinct from
 *  coreBundleHash() (the plain concatenated-bundle hash the catalog snapshot versions against). */
export function coreProfileHash(): string {
  return profileHash(corePackHashes())
}

/** Apply core + packs into a fresh PGlite, per-file in dependency order (a single giant exec can choke pglite),
 *  bracketing each pack's files with `set_config('enumeratio.pack', …)` (see applyPackSegments). */
export async function buildCore(): Promise<PGlite> {
  const pg = new PGlite()
  await pg.waitReady
  const { core, packs } = loadCoreAndPacks()
  const segments = segmentByPack(orderPacks(core, packs), core, packs)
  await applyPackSegments(segments, async (_label, sql) => { await pg.exec(sql) })
  return pg
}

// Boot the core in node, FAST — the node analogue of the client's browser boot.ts. MOUNT the prebuilt dump
// (loadDataDir, ~1s) instead of re-exec'ing sqlsrc (~10s at the current catalog size), but only when EVERY pack's
// stamped hash (in `_pack_version`, one row per loaded pack — #283 phase 1.4) matches its live hash — a stale or
// missing dump self-heals by rebuilding from source. This is what makes "always mount" safe for the test/build
// consumers, which must see the CURRENT schema.
//
// The rebuild itself is still all-or-nothing (buildCore() re-execs core+packs from scratch): today's loader
// applies each pack's files as one exec pass with no support for tearing down and re-applying a single pack in
// isolation (a pack's DDL isn't written to be idempotent against an already-loaded pack). A correct whole rebuild
// that REPORTS which pack forced it beats a per-pack rebuild that silently gets pack boundaries wrong.
export async function bootCore(): Promise<PGlite> {
  try {
    const bytes = await readFile(coreDumpPath)
    const pg = new PGlite({ loadDataDir: new Blob([bytes]) })
    await pg.waitReady
    const r = await pg
      .query<{ pack: string; hash: string }>('SELECT pack, hash FROM _pack_version')
      .catch(() => ({ rows: [] as { pack: string; hash: string }[] }))
    const stale = stalePacks(r.rows, corePackHashes())
    if (r.rows.length > 0 && stale.length === 0) return pg   // every pack's stamped hash matches live → fast path
    if (stale.length) console.warn(`enumeratio: bootCore self-heal — rebuilding (stale pack(s): ${stale.join(', ')})`)
    await pg.close()                                          // stale/missing dump → rebuild from source below
  } catch {
    /* dump absent / failed to mount → build from source */
  }
  return buildCore()
}
