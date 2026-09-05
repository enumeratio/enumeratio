// Node-only disk reader for `packs/<p>/` directories (#283 phase 1.2). Pure fs + the shared manifest parser
// (sqlsrc-order.ts) — every node loader (node.ts, run.mts, dump.ts via node.ts) reads packs through this one
// function so the manifest format has exactly one reader. The browser entry (index.ts) can't use fs; it reads the
// same `packs/*/*.sql` shape via `import.meta.glob` and calls `parsePackManifest` directly on the glob result.
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'
import { PACK_MANIFEST, parsePackManifest, type Pack, type SqlFile } from './sqlsrc-order.ts'

/**
 * Read every `packs/<name>/` directory under `packsDir` into `Pack` objects (unordered — `orderPacks` does the
 * toposort). Returns `[]` when `packsDir` doesn't exist yet, which is the state today (task 1.2 lands the plumbing
 * before any pack is actually extracted) — the no-op acceptance test for this task depends on that.
 */
export function readPacksFromDisk(packsDir: string): Pack[] {
  if (!existsSync(packsDir)) return []
  const dirNames = readdirSync(packsDir, { withFileTypes: true })
    .filter(d => d.isDirectory())
    .map(d => d.name)
    .sort()
  return dirNames.map(dirName => {
    const dir = join(packsDir, dirName)
    const manifestPath = join(dir, `${PACK_MANIFEST}.sql`)
    if (!existsSync(manifestPath)) {
      throw new Error(`pack directory "${dirName}" is missing its ${PACK_MANIFEST}.sql manifest`)
    }
    const { pack, requiresPack } = parsePackManifest(readFileSync(manifestPath, 'utf8'))
    if (pack !== dirName) {
      throw new Error(`pack manifest in "packs/${dirName}/" declares "-- pack: ${pack}" — must match its directory name`)
    }
    const files: SqlFile[] = readdirSync(dir)
      .filter(f => f.endsWith('.sql'))
      .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') }))
    return { name: pack, requiresPack, files }
  })
}
