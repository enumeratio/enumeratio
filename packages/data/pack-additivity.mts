// The additivity differential (#283, wiki Core-And-Packs §6): the generic "a pack never patches core" oracle.
// Boot a fresh pglite, load CORE alone (orderSqlsrc order, same as run.mts), fingerprint the catalog — every
// pg_proc signature in the public schema, plus every base_* table row hashed via md5(t::text) — then load the
// requested packs and fingerprint again. Assert before ⊆ after: every core signature/row-hash must still be
// present. A missing signature means an object was replaced (CREATE OR REPLACE / DROP+re-CREATE); a missing
// row-hash means a row was UPDATEd or DELETEd. No hand-authored expectations — the trusted-but-slow reference
// is just "the catalog before", same shape as the accelerated==naive self-cert differential.
//   node --import tsx pack-additivity.mts                      # core-vs-core: trivially green (no packs/ yet)
//   node --import tsx pack-additivity.mts --pack paths --pack rank
import { readdirSync, readFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { orderSqlsrc } from './sqlsrc-order'

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

// ---- argv: repeatable --pack P --------------------------------------------------------------------------------
const packs: string[] = []
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--pack') { const p = process.argv[++i]; if (p) packs.push(p) }
}

const coreDir = join(here, 'sqlsrc')
const coreFiles = orderSqlsrc(
  readdirSync(coreDir).filter(f => f.endsWith('.sql'))
    .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(coreDir, f), 'utf8') })),
).map(f => `${f.name}.sql`)

const pg = new PGlite()
await pg.waitReady

async function apply(label: string, sql: string) {
  try { await pg.exec(sql) }
  catch (e: any) { console.error(`\n✗ FAILED applying ${label}\n  ${e.message.split('\n')[0]}\n`); await pg.close(); process.exit(1) }
}

for (const f of coreFiles) await apply(f, readFileSync(join(coreDir, f), 'utf8'))
console.log(`loaded core: ${coreFiles.length} sql files.\n`)

// ---- fingerprint: pg_proc signatures + per-row md5 hashes of every base_* table --------------------------------
type Fingerprint = { functions: Set<string>; tables: Map<string, Set<string>> }

async function fingerprint(): Promise<Fingerprint> {
  const sigRows = (await pg.query(
    `SELECT p.oid::regprocedure::text || ' => ' || pg_get_function_result(p.oid) AS sig
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace`,
  )).rows as { sig: string }[]
  const functions = new Set(sigRows.map(r => r.sig))

  const tableRows = (await pg.query(
    `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_name LIKE 'base\\_%' ESCAPE '\\'`,
  )).rows as { table_name: string }[]

  const tables = new Map<string, Set<string>>()
  for (const { table_name } of tableRows) {
    const rows = (await pg.query(`SELECT md5(t::text) AS h FROM "${table_name}" t`)).rows as { h: string }[]
    tables.set(table_name, new Set(rows.map(r => r.h)))
  }
  return { functions, tables }
}

function fingerprintSize(fp: Fingerprint) {
  const rowCount = [...fp.tables.values()].reduce((n, s) => n + s.size, 0)
  return { functions: fp.functions.size, rowCount, tableCount: fp.tables.size }
}

const beforeFp = await fingerprint()
const before = fingerprintSize(beforeFp)
console.log(
  `fingerprint before: ${before.functions} functions, ${before.rowCount} base rows across ${before.tableCount} tables`,
)

// ---- load the requested packs (if any) -------------------------------------------------------------------------
// GUC guard: task 0.2 lands `enumeratio.pack`; a placeholder custom GUC is harmless to set even before that
// lands, but guard anyway in case some future backend rejects unrecognized custom GUCs outright.
async function setPackGuc(pack: string) {
  try { await pg.query(`SELECT set_config('enumeratio.pack', $1, false)`, [pack]) }
  catch { /* GUC not wired up yet (task 0.2) — fine, ignore */ }
}

const packsDir = join(here, 'packs')
for (const pack of packs) {
  const dir = join(packsDir, pack)
  if (!existsSync(dir)) {
    console.error(`✗ pack "${pack}" not found: ${dir} does not exist`)
    await pg.close()
    process.exit(1)
  }
  await setPackGuc(pack)
  // Pack-internal file ordering (requires:/requires-tag: against core files, already loaded) is out of scope for
  // this differential — task 0.2/pack-map own the real per-pack load graph. Lexical order is enough to prove the
  // additivity oracle itself is correct, and today packs/ doesn't exist so this path never runs.
  const files = readdirSync(dir).filter(f => f.endsWith('.sql')).sort()
  for (const f of files) await apply(`${pack}/${f}`, readFileSync(join(dir, f), 'utf8'))
}

const afterFp = await fingerprint()
const after = fingerprintSize(afterFp)
console.log(
  `fingerprint after:  ${after.functions} functions, ${after.rowCount} base rows across ${after.tableCount} tables`,
)

// ---- assert before ⊆ after: no core signature or row-hash may go missing ----------------------------------------
let violations = 0
const cap = 20

const missingSigs = [...beforeFp.functions].filter(s => !afterFp.functions.has(s))
if (missingSigs.length) {
  violations++
  console.error(`\n✗ ${missingSigs.length} function signature(s) missing after pack load (object replaced):`)
  for (const s of missingSigs.slice(0, cap)) console.error(`    ${s}`)
  if (missingSigs.length > cap) console.error(`    … and ${missingSigs.length - cap} more`)
}

for (const [table, hashesBefore] of beforeFp.tables) {
  const hashesAfter = afterFp.tables.get(table)
  if (!hashesAfter) {
    violations++
    console.error(`\n✗ table "${table}" present before but missing entirely after pack load`)
    continue
  }
  const missing = [...hashesBefore].filter(h => !hashesAfter.has(h))
  if (missing.length) {
    violations++
    console.error(`\n✗ table "${table}": ${missing.length} row hash(es) missing after pack load (row updated/deleted):`)
    for (const h of missing.slice(0, cap)) console.error(`    ${h}`)
    if (missing.length > cap) console.error(`    … and ${missing.length - cap} more`)
  }
}

await pg.close()
if (violations) { console.error(`\n${violations} additivity violation(s) — a pack patched core.`); process.exit(1) }
console.log(packs.length ? `\nadditivity holds: core unchanged by pack(s) ${packs.join(', ')}.` : '\nadditivity holds (core-vs-core, no packs given).')
