// Emit the build-time catalog snapshot FRAGMENTS shipped in the package tarball (#283 phase 4 — see
// catalog-snapshot.ts for what the snapshot is and why it's a release artifact rather than a repo file). One
// `catalog-snapshot.<pack>.json` per pack (core included), each stamped with that PACK's own hash — not the whole
// profile — so client/node.ts can tell exactly which pack(s) went stale without re-reading every fragment. Runs at
// `prepack` and on demand via the package's `build`, beside build-pgdata.mts.
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootCore, coreProfileHash, corePackHashes } from './node.ts'
import { buildCatalogSnapshot, loadPackOwnership, splitCatalogSnapshotByPack } from './catalog-snapshot.ts'

const here = dirname(fileURLToPath(import.meta.url))
const pg = await bootCore()
// the trailing comma in `<T,>` is required in a .mts file — a bare `<T>` reads as JSX there
const query = async <T,>(sql: string): Promise<T[]> => (await pg.query(sql)).rows as T[]

// The full snapshot is stamped with the PROFILE hash (hash.ts) — the merged-at-runtime shape client/node.ts
// rebuilds live when a fragment goes stale — even though this file no longer writes it out itself; the ownership
// query below needs the same live connection, so build it once here rather than opening a second pglite.
const snap = await buildCatalogSnapshot(query, coreProfileHash())
const ownership = await loadPackOwnership(query)
await pg.close()

const packHashes = corePackHashes()
const fragments = splitCatalogSnapshotByPack(snap, ownership, packHashes)

for (const { pack } of packHashes) {
  const frag = fragments.get(pack)
  if (!frag) continue   // a pack with zero owned rows (shouldn't happen — every pack owns at least its own collections)
  const path = join(here, `catalog-snapshot.${pack}.json`)
  const json = JSON.stringify(frag)
  await writeFile(path, json)
  console.log(
    `catalog-snapshot.${pack}.json — ${(json.length / 1024).toFixed(0)} KiB · ${frag.functions.length} functions ` +
    `(${frag.functions.reduce((n, f) => n + f.impls.length, 0)} impls) · ${frag.collections.length} collections · ` +
    `${frag.grants.length} grants · ${frag.foldable.length} foldable`)
}
