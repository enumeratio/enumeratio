// Browser/Vite entry for the pure-SQL core: the per-file SQL sources + the concatenated bundle, so a consumer
// (e.g. enumeratio-docs) can load the whole core into an in-browser pglite and read its catalog. Vite inlines the
// SQL at build via import.meta.glob(?raw); the node runner (run.mts) reads the same files from disk instead.
// Files are ordered by their `-- requires:` dependency headers (bootstrap.sql first) — the same toposort run.mts uses.
import { orderPacks, parsePackManifest, PACK_MANIFEST, type Pack } from './sqlsrc-order'
import { bundleHash } from './hash'

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

// The build-time catalog snapshot, when the artifact exists. import.meta.glob (not a static import) because the
// file is a generated, gitignored release artifact: a glob that matches nothing is an empty record, while a static
// import of a missing file is a build error. Absent ⇒ null ⇒ the engine that needs it declines.
// @ts-ignore — import.meta.glob is a Vite compile-time transform (see the note above)
const _snapshot = import.meta.glob('./catalog-snapshot.json', { import: 'default', eager: true }) as Record<string, unknown>
export const catalogSnapshot = (Object.values(_snapshot)[0] ?? null) as import('./catalog-snapshot').CatalogSnapshot | null
export type { CatalogSnapshot } from './catalog-snapshot'
