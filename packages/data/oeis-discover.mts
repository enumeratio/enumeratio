// OEIS discovery — dump the cardinality sequence for every collection with NO existing base_reference(system='oeis')
// row, for a downstream Sage reverse-search (oeis(terms)) to propose A-number candidates. This script only PRODUCES
// data; it never writes base_reference itself — a Sage-suggested match is a candidate, not a verified fact.
//
// Each collection is swept in its OWN subprocess (oeis-single.mts) under an OS `timeout`: pglite runs synchronously
// in-process, so a pathological (collection, n) query can't be cancelled cooperatively from JS — isolating per
// collection means one hang costs one skipped collection, not the whole sweep.
//
//   node --import tsx oeis-discover.mts [out.json]
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { execFileSync } from 'node:child_process'
import { orderSqlsrc } from './sqlsrc-order'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

const PER_COLLECTION_TIMEOUT_MS = 20_000
const outPath = process.argv[2] ?? join(here, '..', '..', '.scratch', 'oeis-discover.json')

const dir = join(here, 'sqlsrc')
const files = orderSqlsrc(
  readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') })),
).map((f) => `${f.name}.sql`)

const pg = new PGlite()
await pg.waitReady
for (const f of files) {
  try { await pg.exec(readFileSync(join(dir, f), 'utf8')) }
  catch (e: any) { console.error(`✗ FAILED applying ${f}\n  ${e.message.split('\n')[0]}`); await pg.close(); process.exit(1) }
}
const collections = (await pg.query(`
  SELECT c.id AS id
    FROM base_catalog c
   WHERE NOT EXISTS (SELECT 1 FROM base_reference r WHERE r.subject_kind = 'collection' AND r.subject = c.id AND r.system = 'oeis')
   ORDER BY c.id`)).rows as { id: string }[]
await pg.close()

console.error(`${collections.length} collections have no existing oeis reference row`)

type Row = { id: string; terms: string[]; offset: number }
const results: Row[] = []
const timedOut: string[] = []

for (const c of collections) {
  process.stderr.write(`  · ${c.id} ... `)
  try {
    const out = execFileSync(
      process.execPath, ['--import', 'tsx', join(here, 'oeis-single.mts'), c.id],
      { cwd: here, timeout: PER_COLLECTION_TIMEOUT_MS, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] },
    )
    const row: Row = JSON.parse(out.trim().split('\n').pop()!)
    if (row.terms.length >= 4) { results.push(row); console.error(`${row.terms.length} terms`) }
    else console.error(`only ${row.terms.length} usable term(s), skipped`)
  } catch (e: any) {
    if (e.signal || e.killed) { timedOut.push(c.id); console.error('TIMED OUT') }
    else console.error(`ERROR ${String(e.message ?? e).split('\n')[0]}`)
  }
}

writeFileSync(outPath, JSON.stringify(results, null, 2))
console.error(`\nwrote ${results.length} candidate sequences to ${outPath}`)
if (timedOut.length) console.error(`timed out (skipped, needs manual look): ${timedOut.join(', ')}`)
