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

/** Path to the prebuilt gzipped-tar dump for one PROFILE (#283 phase 4, wiki §7) — 'core' (core only, no packs)
 *  or 'all' (core + every extracted pack). Built by build-pgdata.mts / the client build; mounted by bootCore(). */
export function dumpPath(profile: 'core' | 'all' = 'all'): string {
  return join(here, profile === 'core' ? 'enumeratio-core.pgdata' : 'enumeratio-all.pgdata')
}

/** The 'all'-profile dump path — every caller before the profile split (#283 phase 4) always meant this one.
 *  Kept as a plain value (not a function) so existing callers (client/src/node.ts's worker boot payload) don't
 *  need an edit; equivalent to `dumpPath('all')`. */
export const coreDumpPath = dumpPath('all')

/** The per-pack catalog-snapshot fragment (#283 phase 4): `catalog-snapshot.<pack>.json`, built by
 *  build-catalog-snapshot.mts alongside the dump — same lifecycle, gitignored release artifact. */
export function catalogSnapshotFragmentPath(pack: string): string {
  return join(here, `catalog-snapshot.${pack}.json`)
}

/** Every pack-fragment snapshot that exists on disk, keyed by pack id. A fragment missing entirely (never built,
 *  or a pack extracted since) simply isn't in the map — never throws; an absent or incomplete set degrades to
 *  "the caller rebuilds live" (client/node.ts), same as a missing single blob did before the split. */
export async function loadCatalogSnapshotFragments(profile: 'core' | 'all' = 'all'): Promise<Map<string, CatalogSnapshot>> {
  const out = new Map<string, CatalogSnapshot>()
  for (const { pack } of corePackHashes(profile)) {
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

/** The pack list for one PROFILE (#283 phase 4, wiki §7): 'all' is core + every extracted pack (every caller's
 *  behaviour before the profile split); 'core' is core alone. A pure filter over an already-loaded pack list,
 *  rather than a second disk-walk. */
function profilePacks(profile: 'core' | 'all', packs: Pack[]): Pack[] {
  return profile === 'all' ? packs : []
}

/** The ordered files (bootstrap first, then any extracted packs in `requires-pack` order — 'all' profile — or
 *  just core's own files — 'core' profile), read from disk. Defaults to 'all': every caller before the profile
 *  split (#283 phase 4) got core+packs, and this keeps that behaviour for a 0-arg call. With zero packs under
 *  `packs/*` this is byte-identical to `orderSqlsrc(sqlsrc/*)` — see sqlsrc-order.test.ts. */
export function coreFiles(profile: 'core' | 'all' = 'all'): SqlFile[] {
  const { core, packs } = loadCoreAndPacks()
  return orderPacks(core, profilePacks(profile, packs))
}

/** The profile as one concatenated bundle, dependency-ordered. */
export function coreBundle(profile: 'core' | 'all' = 'all'): string {
  return coreFiles(profile).map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')
}

/** Content hash of the current sqlsrc bundle for this profile. Matches index.ts's coreBundleHash — the value
 *  stamped into a dump. */
export function coreBundleHash(profile: 'core' | 'all' = 'all'): string {
  return bundleHash(coreBundle(profile))
}

/** Per-pack hashes for the CURRENT profile on disk, in profile order (core first, §7). One row per loaded pack —
 *  the 'core' profile is always a single 'core' row. */
export function corePackHashes(profile: 'core' | 'all' = 'all'): PackHash[] {
  const { core, packs } = loadCoreAndPacks()
  const p = profilePacks(profile, packs)
  return packHashes(segmentByPack(orderPacks(core, p), core, p))
}

/** The profile hash (§7): hash of the ordered per-pack hashes for the current profile. Distinct from
 *  coreBundleHash() (the plain concatenated-bundle hash the catalog snapshot versions against). */
export function coreProfileHash(profile: 'core' | 'all' = 'all'): string {
  return profileHash(corePackHashes(profile))
}

/** Apply one PROFILE into a fresh PGlite, per-file in dependency order (a single giant exec can choke pglite),
 *  bracketing each pack's files with `set_config('enumeratio.pack', …)` (see applyPackSegments). Defaults to
 *  'all' — every caller before the profile split (#283 phase 4) got core+packs. */
export async function buildCore(profile: 'core' | 'all' = 'all'): Promise<PGlite> {
  const pg = new PGlite()
  await pg.waitReady
  const { core, packs } = loadCoreAndPacks()
  const p = profilePacks(profile, packs)
  const segments = segmentByPack(orderPacks(core, p), core, p)
  await applyPackSegments(segments, async (_label, sql) => { await pg.exec(sql) })
  return pg
}

// Boot one PROFILE in node, FAST — the node analogue of the client's browser boot.ts. MOUNT that profile's
// prebuilt dump (loadDataDir, ~1s) instead of re-exec'ing sqlsrc (~10s at the current catalog size), but only when
// EVERY pack THIS PROFILE LOADS has a stamped hash (in `_pack_version`, one row per loaded pack — #283 phase 1.4)
// matching its live hash — a stale or missing dump self-heals by rebuilding from source. This is what makes
// "always mount" safe for the test/build consumers, which must see the CURRENT schema. Defaults to 'all': every
// caller before the profile split (#283 phase 4) got core+packs, and this keeps that behaviour for a 0-arg call —
// docs/CLI/tests all need the full catalog (O.2), so nothing here needed to opt into 'all' explicitly.
//
// The rebuild itself is still all-or-nothing WITHIN a profile (buildCore(profile) re-execs that profile's files
// from scratch) — and that is a DELIBERATE decision, not a gap left open by this ticket (#321):
//   - Today's loader (applyPackSegments) applies each pack's files as one exec pass into a session that has
//     nothing loaded yet for that pack. There is no "tear down pack P's tables/types/rows and re-apply just P"
//     operation anywhere in the stack — a pack's DDL (CREATE TYPE/FUNCTION/TABLE) is written assuming those names
//     don't already exist, so re-running it against an already-loaded pack fails on the first CREATE, and nothing
//     DROPs a pack's objects in dependency order (the reverse of a toposort this codebase has never needed before).
//   - stalePacks() already tells the caller EXACTLY which pack(s) forced the rebuild (see the console.warn below) —
//     the diagnostic value phase 1.4 wanted is delivered without needing incremental re-application.
//   - A pack-scoped rebuild's payoff is bounded by how many packs are OUTSIDE the mounted profile in the first
//     place: the 'core' profile has none stale-by-definition once core itself hasn't changed (packs aren't even
//     loaded), and the 'all' profile going stale from ONE pack's edit still means re-execing every pack anyway to
//     get back to a self-consistent whole-profile dump — there's no smaller unit of work to do UNTIL a real
//     "DROP pack P" primitive exists, which is its own project (reverse-toposort teardown SQL per pack, or
//     `DROP EXTENSION enumeratio_<pack>` once #122's `.control` packaging — build-control.mts — is a real install
//     path rather than a packaging-artifact proof). A correct whole rebuild that REPORTS which pack forced it
//     beats a partial one that silently gets pack boundaries wrong.
export async function bootCore(profile: 'core' | 'all' = 'all'): Promise<PGlite> {
  try {
    const bytes = await readFile(dumpPath(profile))
    const pg = new PGlite({ loadDataDir: new Blob([bytes]) })
    await pg.waitReady
    const r = await pg
      .query<{ pack: string; hash: string }>('SELECT pack, hash FROM _pack_version')
      .catch(() => ({ rows: [] as { pack: string; hash: string }[] }))
    const stale = stalePacks(r.rows, corePackHashes(profile))
    if (r.rows.length > 0 && stale.length === 0) return pg   // every pack's stamped hash matches live → fast path
    if (stale.length) console.warn(`enumeratio: bootCore self-heal (${profile}) — rebuilding (stale pack(s): ${stale.join(', ')})`)
    await pg.close()                                          // stale/missing dump → rebuild from source below
  } catch {
    /* dump absent / failed to mount → build from source */
  }
  return buildCore(profile)
}
