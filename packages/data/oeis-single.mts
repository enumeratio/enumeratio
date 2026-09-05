// Worker for oeis-discover.mts: boots pglite, computes ONE collection's cardinality sequence, prints JSON to stdout.
// Run under an OS `timeout` by the driver — pglite runs synchronously in-process, so a pathological (collection, n)
// query cannot be cancelled cooperatively; isolating each collection in its own process lets one hang be killed
// without losing the rest of the sweep.
//
//   node --import tsx oeis-single.mts <collection-id>
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { orderSqlsrc } from './sqlsrc-order'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

const NTERMS = 12
const NMAX = 20
const CAP = 10_000_000n

const id = process.argv[2]
if (!id) { console.error('usage: oeis-single.mts <collection-id>'); process.exit(2) }

const dir = join(here, 'sqlsrc')
const files = orderSqlsrc(
  readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') })),
).map((f) => `${f.name}.sql`)

const pg = new PGlite()
await pg.waitReady
for (const f of files) await pg.exec(readFileSync(join(dir, f), 'utf8'))
await pg.exec(`SET statement_timeout = '3s'`)
const q = async (sql: string) => (await pg.query(sql)).rows as any[]

const terms: string[] = []
let offset = 0
let sawFirstFinite = false
for (let n = 0; n <= NMAX && terms.length < NTERMS; n++) {
  let val: string | null = null
  try {
    const rows = await q(`SELECT cardinality(${id}(${n}))::text AS v`)
    val = rows[0]?.v ?? null
  } catch {
    continue
  }
  if (val == null || val === 'Infinity' || val === 'NaN' || !/^\d+$/.test(val)) continue
  if (!sawFirstFinite) { offset = n; sawFirstFinite = true }
  if (BigInt(val) > CAP) break
  terms.push(val)
}
await pg.close()
console.log(JSON.stringify({ id, terms, offset }))
