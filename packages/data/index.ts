// Browser/Vite entry for the pure-SQL CORE only (#283 phase 4, wiki §7 / O.1-O.2). The root `@enumeratio/data`
// export is CORE-ONLY: a consumer that needs the whole catalog (every extracted pack — docs, the explorer) imports
// `@enumeratio/data/all` instead, and `@enumeratio/data/packs/<p>` gets one pack's own files + manifest + snapshot
// fragment. This file is deliberately a near-duplicate of all.ts with the packs glob removed, rather than a config
// flag threaded through one shared module — see all.ts's header for why.
//
// Vite inlines the SQL at build via import.meta.glob(?raw); the node runner (node.ts) reads the same files from
// disk instead. Files are ordered by their `-- requires:` dependency headers (bootstrap.sql first) — the same
// toposort run.mts uses.
import { orderPacks, type Pack } from './sqlsrc-order'
import { bundleHash, packHashes, profileHash, type PackHash } from './hash'
import type { CatalogSnapshot as CatalogSnapshotType } from './catalog-snapshot'
export { stalePacks, type PackHash } from './hash'

// @ts-ignore — import.meta.glob is a Vite compile-time transform (typed via vite/client in the docs app); this
// file is also type-checked by consumers that lack vite/client, so ignore the missing-type there. Vite still
// transforms the literal `import.meta.glob(...)` call regardless.
const modules = import.meta.glob('./sqlsrc/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const core: Pack = {
  name: 'core',
  requiresPack: [],
  files: Object.entries(modules).map(([path, sql]) => ({ name: (path.split('/').pop() as string).replace(/\.sql$/, ''), content: sql })),
}

const ordered = orderPacks(core, [])   // core only — no packs

export const coreFiles: Record<string, string> = Object.fromEntries(ordered.map(f => [`${f.name}.sql`, f.content]))

export const coreBundle: string = ordered.map(f => `-- ═══ ${f.name}.sql ═══\n${f.content}`).join('\n')

// Content hash of the bundle — the client compares it against the version stamped into a prebuilt dump to decide
// whether the dump is fresh (mount it) or stale (rebuild from sqlsrc). Must match node.ts's coreBundleHash('core').
export const coreBundleHash: string = bundleHash(coreBundle)

// Per-pack hashes (§7) — always a single 'core' row for this entry.
export const corePackHashes: PackHash[] = packHashes([{ pack: 'core', files: ordered }])

// The profile hash (§7): hash of the ordered per-pack hashes — distinct from coreBundleHash (see hash.ts).
export const coreProfileHash: string = profileHash(corePackHashes)

// The build-time catalog snapshot fragment for core (#283 phase 4), when the artifact exists. import.meta.glob
// (not a static import) because it's a generated, gitignored release artifact: a glob that matches nothing is an
// empty record, while a static import of a missing file is a build error.
// @ts-ignore — import.meta.glob is a Vite compile-time transform (see the note above)
const _fragment = import.meta.glob('./catalog-snapshot.core.json', { import: 'default', eager: true }) as Record<string, CatalogSnapshotType>
const fragment = Object.values(_fragment)[0] ?? null

// null when the fragment was never built — same degrade-to-decline behaviour as all.ts (registry.ts).
export const catalogSnapshot: CatalogSnapshotType | null = fragment ? { ...fragment, hash: coreProfileHash } : null
export type { CatalogSnapshot } from './catalog-snapshot'
