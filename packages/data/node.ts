// Node entry for the pure-SQL core: read the sqlsrc files from DISK and order them by their `-- requires:`
// headers — the same toposort the Vite bundle (index.ts) and run.mts use, but without import.meta.glob (which
// only exists under a bundler). Consumers that run in node (the CLI, tests) load the core through this.
import { readFile } from 'node:fs/promises'
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { orderSqlsrc, type SqlFile } from './sqlsrc-order.ts'
import { bundleHash } from './hash.ts'
import type { CatalogSnapshot } from './catalog-snapshot.ts'
export type { CatalogSnapshot } from './catalog-snapshot.ts'
export { bundleHash } from './hash.ts'   // so a consumer can hash a bundle it already read, without a second read

const here = dirname(fileURLToPath(import.meta.url))
export const sqlsrcDir = join(here, 'sqlsrc')

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

/** The ordered sqlsrc files (bootstrap first), read from disk. */
export function coreFiles(): SqlFile[] {
  return orderSqlsrc(
    readdirSync(sqlsrcDir)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(sqlsrcDir, f), 'utf8') })),
  )
}

/** The whole core as one concatenated bundle, dependency-ordered. */
export function coreBundle(): string {
  return coreFiles().map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')
}

/** Content hash of the current sqlsrc bundle. Matches index.ts's coreBundleHash — the value stamped into a dump. */
export function coreBundleHash(): string {
  return bundleHash(coreBundle())
}

/** Apply the sqlsrc into a fresh PGlite, per-file in dependency order (a single giant exec can choke pglite). */
export async function buildCore(): Promise<PGlite> {
  const pg = new PGlite()
  await pg.waitReady
  for (const f of coreFiles()) await pg.exec(f.content)
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
