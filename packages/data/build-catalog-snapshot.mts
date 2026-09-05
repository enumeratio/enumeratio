// Emit the build-time catalog snapshot shipped in the package tarball (see catalog-snapshot.ts for what it is and
// why it is a release artifact rather than a repo file). Runs at `prepack` and on demand via the package's `build`,
// beside build-pgdata.mts, and is stamped with the same bundle hash — so the two artifacts are always the same core.
import { writeFile } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { bootCore, coreBundleHash } from './node.ts'
import { buildCatalogSnapshot } from './catalog-snapshot.ts'

const out = join(dirname(fileURLToPath(import.meta.url)), 'catalog-snapshot.json')
const pg = await bootCore()
const snap = await buildCatalogSnapshot(async <T>(sql: string) => (await pg.query(sql)).rows as T[], coreBundleHash())
await pg.close()
const json = JSON.stringify(snap)
await writeFile(out, json)
console.log(
  `catalog-snapshot.json — ${(json.length / 1024).toFixed(0)} KiB · ${snap.functions.length} functions ` +
  `(${snap.functions.reduce((n, f) => n + f.impls.length, 0)} impls) · ${snap.collections.length} collections · ` +
  `${snap.grants.length} grants · ${snap.foldable.length} foldable`)
