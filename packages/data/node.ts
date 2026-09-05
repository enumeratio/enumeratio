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
import { bundleHash } from './hash.ts'
import type { CatalogSnapshot } from './catalog-snapshot.ts'
export type { CatalogSnapshot } from './catalog-snapshot.ts'
export { bundleHash } from './hash.ts'   // so a consumer can hash a bundle it already read, without a second read

const here = dirname(fileURLToPath(import.meta.url))
export const sqlsrcDir = join(here, 'sqlsrc')
export const packsDir = join(here, 'packs')

/** The prebuilt gzipped-tar dump (built by build-pgdata.mts / the client build). Mounted by bootCore(). */
export const coreDumpPath = join(here, 'enumeratio-core.pgdata')

/** The build-time catalog snapshot (built by build-catalog-snapshot.mts). Sibling artifact of the dump, same
 *  lifecycle: generated, gitignored, shipped in the tarball. */
export const catalogSnapshotPath = join(here, 'catalog-snapshot.json')

/** The snapshot, or null when it was never built (a source checkout) or is unreadable. Never throws — an absent
 *  snapshot must degrade to "the engine that needs it declines", never to a crash. Staleness is the CALLER's
 *  check: compare `hash` against coreBundleHash(). */
export async function loadCatalogSnapshot(): Promise<CatalogSnapshot | null> {
  try {
    return JSON.parse(await readFile(catalogSnapshotPath, 'utf8')) as CatalogSnapshot
  } catch {
    return null
  }
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
// (loadDataDir, ~1s) instead of re-exec'ing sqlsrc (~10s at the current catalog size), but only when its stamped
// bundle hash matches the live sqlsrc — a stale or missing dump self-heals by rebuilding from source. This is what
// makes "always mount" safe for the test/build consumers, which must see the CURRENT schema.
export async function bootCore(): Promise<PGlite> {
  try {
    const bytes = await readFile(coreDumpPath)
    const pg = new PGlite({ loadDataDir: new Blob([bytes]) })
    await pg.waitReady
    const r = await pg
      .query<{ hash: string }>('SELECT hash FROM _core_version LIMIT 1')
      .catch(() => ({ rows: [] as { hash: string }[] }))
    if (r.rows[0]?.hash === coreBundleHash()) return pg   // fresh dump → the fast path
    await pg.close()                                       // stale dump → rebuild from source below
  } catch {
    /* dump absent / failed to mount → build from source */
  }
  return buildCore()
}
