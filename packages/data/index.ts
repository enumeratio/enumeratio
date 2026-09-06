// Browser/Vite entry for the pure-SQL core: the per-file SQL sources + the concatenated bundle, so a consumer
// (e.g. enumeratio-docs) can load the whole core into an in-browser pglite and read its catalog. Vite inlines the
// SQL at build via import.meta.glob(?raw); the node runner (run.mts) reads the same files from disk instead.
// Files are ordered by their `-- requires:` dependency headers (bootstrap.sql first) — the same toposort run.mts uses.
import { orderPacks, parsePackManifest, PACK_MANIFEST, segmentByPack, type Pack } from './sqlsrc-order'
import { bundleHash, packHashes, profileHash, type PackHash } from './hash'
import { mergeCatalogSnapshots, type CatalogSnapshot as CatalogSnapshotType } from './catalog-snapshot'
export { stalePacks, type PackHash } from './hash'

// @ts-ignore — import.meta.glob is a Vite compile-time transform (typed via vite/client in the docs app); this
// file is also type-checked by consumers that lack vite/client, so ignore the missing-type there. Vite still
// transforms the literal `import.meta.glob(...)` call regardless.
const modules = import.meta.glob('./sqlsrc/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

// @ts-ignore — see above; matches nothing today (no packs/ dir), which is an empty record, not a build error.
const packModules = import.meta.glob('./packs/*/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const core: Pack = {
  name: 'core',
  requiresPack: [],
  files: Object.entries(modules).map(([path, sql]) => ({ name: (path.split('/').pop() as string).replace(/\.sql$/, ''), content: sql })),
}

// group the pack glob's flat path->content map by its packs/<name>/ directory, the same shape pack-loader.ts's
// readPacksFromDisk builds from fs — this is the browser-side reader (no fs, so it can't share that function).
const packFilesByDir = new Map<string, { name: string; content: string }[]>()
for (const [path, sql] of Object.entries(packModules)) {
  const m = path.match(/^\.\/packs\/([^/]+)\/([^/]+)\.sql$/)
  if (!m) continue
  const [, dirName, base] = m
  if (!packFilesByDir.has(dirName)) packFilesByDir.set(dirName, [])
  packFilesByDir.get(dirName)!.push({ name: base, content: sql })
}
const packs: Pack[] = [...packFilesByDir.entries()].map(([dirName, files]) => {
  const manifest = files.find(f => f.name === PACK_MANIFEST)
  if (!manifest) throw new Error(`pack directory "packs/${dirName}/" is missing its ${PACK_MANIFEST}.sql manifest`)
  const { pack, requiresPack } = parsePackManifest(manifest.content)
  if (pack !== dirName) throw new Error(`pack manifest in "packs/${dirName}/" declares "-- pack: ${pack}" — must match its directory name`)
  return { name: pack, requiresPack, files }
})

const ordered = orderPacks(core, packs)

export const coreFiles: Record<string, string> = Object.fromEntries(ordered.map(f => [`${f.name}.sql`, f.content]))

export const coreBundle: string = ordered.map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')

// Content hash of the bundle — the client compares it against the version stamped into a prebuilt dump to decide
// whether the dump is fresh (mount it) or stale (rebuild from sqlsrc). Must match node.ts's coreBundleHash().
export const coreBundleHash: string = bundleHash(coreBundle)

// Per-pack hashes (§7), one row per loaded pack — with zero packs extracted (today) a single 'core' row whose
// hash equals coreBundleHash. Lets the client detect exactly which pack(s) went stale in a mounted dump.
export const corePackHashes: PackHash[] = packHashes(segmentByPack(ordered, core, packs))

// The profile hash (§7): hash of the ordered per-pack hashes — distinct from coreBundleHash (see hash.ts).
export const coreProfileHash: string = profileHash(corePackHashes)

// The build-time catalog snapshot FRAGMENTS (#283 phase 4), when the artifacts exist. import.meta.glob (not a
// static import) because these are generated, gitignored release artifacts: a glob that matches nothing is an
// empty record, while a static import of a missing file is a build error.
// @ts-ignore — import.meta.glob is a Vite compile-time transform (see the note above)
const _fragments = import.meta.glob('./catalog-snapshot.*.json', { import: 'default', eager: true }) as Record<string, CatalogSnapshotType>
const fragmentByPack = new Map<string, CatalogSnapshotType>()
for (const [path, snap] of Object.entries(_fragments)) {
  const m = path.match(/^\.\/catalog-snapshot\.([^./]+)\.json$/)
  if (m) fragmentByPack.set(m[1], snap)
}

// Merged in the SAME load order as everything else (core first, then packs in `requires-pack` order — the
// `ordered`/corePackHashes order above): null when ANY pack this profile loads has no fragment on disk (never
// built) — an incomplete set degrades to "the engine that needs it declines", same as a missing single blob did
// before the split (registry.ts). No live-rebuild fallback here (unlike client/node.ts's #281 behaviour) — the
// browser has no sqlsrc-reading connection to rebuild FROM before a pglite is booted from this very bundle.
const completeFragments = corePackHashes.every(({ pack }) => fragmentByPack.has(pack))
export const catalogSnapshot: CatalogSnapshotType | null = completeFragments
  ? { ...mergeCatalogSnapshots(corePackHashes.map(({ pack }) => fragmentByPack.get(pack)!)), hash: coreProfileHash }
  : null
export type { CatalogSnapshot } from './catalog-snapshot'
