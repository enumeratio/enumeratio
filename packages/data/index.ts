// Browser/Vite entry for the pure-SQL core: the per-file SQL sources + the concatenated bundle, so a consumer
// (e.g. enumeratio-docs) can load the whole core into an in-browser pglite and read its catalog. Vite inlines the
// SQL at build via import.meta.glob(?raw); the node runner (run.mts) reads the same files from disk instead.
// Files are ordered by their `-- requires:` dependency headers (bootstrap.sql first) — the same toposort run.mts uses.
import { orderSqlsrc } from './sqlsrc-order'
import { bundleHash } from './hash'

// @ts-ignore — import.meta.glob is a Vite compile-time transform (typed via vite/client in the docs app); this
// file is also type-checked by consumers that lack vite/client, so ignore the missing-type there. Vite still
// transforms the literal `import.meta.glob(...)` call regardless.
const modules = import.meta.glob('./sqlsrc/*.sql', { query: '?raw', import: 'default', eager: true }) as Record<string, string>

const ordered = orderSqlsrc(
  Object.entries(modules).map(([path, sql]) => ({ name: (path.split('/').pop() as string).replace(/\.sql$/, ''), content: sql })),
)

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
