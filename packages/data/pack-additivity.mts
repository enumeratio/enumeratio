// The additivity differential (#283, wiki Core-And-Packs §6): the generic "a pack never patches core" oracle.
// Boot a fresh pglite, load CORE alone (orderPacks(core, []) — byte-identical order to orderSqlsrc(sqlsrc/*)),
// fingerprint the catalog — every pg_proc signature in the public schema, plus every base_* table row hashed via
// md5(t::text) — then load the requested packs (in their real requires-pack order, via orderPacks + pack-loader,
// same mechanism node.ts's buildCore() uses) and fingerprint again. Assert before ⊆ after: every core
// signature/row-hash must still be present. A missing signature means an object was replaced (CREATE OR REPLACE /
// DROP+re-CREATE); a missing row-hash means a row was UPDATEd or DELETEd. No hand-authored expectations — the
// trusted-but-slow reference is just "the catalog before", same shape as the accelerated==naive self-cert
// differential.
//   node --import tsx pack-additivity.mts                      # core-vs-core: trivially green (no packs/ yet)
//   node --import tsx pack-additivity.mts --pack refs --pack polytopes
import { createRequire } from 'node:module'
import { orderPacks, segmentByPack, applyPackSegments, type Pack } from './sqlsrc-order'
import { readPacksFromDisk } from './pack-loader'
import { corePack, packsDir } from './node'
import { packClosure, type PackName } from './pack-map'

const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

// ---- argv: repeatable --pack P --------------------------------------------------------------------------------
const requestedPacks: string[] = []
for (let i = 2; i < process.argv.length; i++) {
  if (process.argv[i] === '--pack') { const p = process.argv[++i]; if (p) requestedPacks.push(p) }
}

const core: Pack = corePack()
const allPacks = readPacksFromDisk(packsDir)          // every pack actually EXTRACTED under packs/*
const allPackNames = new Set(allPacks.map(p => p.name))

// Requested packs, plus the transitive requires-pack closure PACK_DEPS declares for each (orderPacks needs every
// dependency present in its `packs` array to resolve a requires-pack edge — passing only the requested pack(s)
// would throw "requires-pack unknown" the moment one names a dependency we didn't also select).
const wanted = new Set<string>()
for (const p of requestedPacks) {
  if (!allPackNames.has(p)) {
    console.error(`✗ pack "${p}" not found under packs/ (extracted packs: ${[...allPackNames].join(', ') || '(none)'})`)
    process.exit(1)
  }
  for (const dep of packClosure(p as PackName)) if (dep !== 'core') wanted.add(dep)
}
const selectedPacks = allPacks.filter(p => wanted.has(p.name))

const pg = new PGlite()
await pg.waitReady

async function apply(label: string, sql: string) {
  try { await pg.exec(sql) }
  catch (e: any) { console.error(`\n✗ FAILED applying ${label}\n  ${e.message.split('\n')[0]}\n`); await pg.close(); process.exit(1) }
}

// ---- load CORE alone (byte-identical order to orderSqlsrc/run.mts --packs core) --------------------------------
const coreOnlySegments = segmentByPack(orderPacks(core, []), core, [])
await applyPackSegments(coreOnlySegments, apply)
const coreFileCount = coreOnlySegments.reduce((n, s) => n + s.files.length, 0)
console.log(`loaded core: ${coreFileCount} sql files.\n`)

// ---- fingerprint: pg_proc signatures + per-row md5 hashes of every base_* table --------------------------------
type Fingerprint = { functions: Set<string>; tables: Map<string, Set<string>> }

async function fingerprint(): Promise<Fingerprint> {
  const sigRows = (await pg.query(
    `SELECT p.oid::regprocedure::text || ' => ' || pg_get_function_result(p.oid) AS sig
       FROM pg_proc p WHERE p.pronamespace = 'public'::regnamespace`,
  )).rows as { sig: string }[]
  const functions = new Set(sigRows.map(r => r.sig))

  // BASE TABLE only — a VIEW (base_map_resolved, base_stat_resolved, base_catalog, …) is DERIVED, and its content
  // is expected to shift additively once a pack's rows widen carrier inheritance (a new pack collection sharing
  // core's carrier legitimately adds inherited rows to an existing core collection's resolution). Worse, a
  // carrier-scope name COLLISION already latent in core (two core collections both registering the same map_id
  // on a shared carrier) makes an inherited VIEW row's underlying winner an unstable `DISTINCT ON` tie — loading
  // more rows can flip which one wins even though no table changed. Only stored rows are what a pack must never
  // touch; that's what `base_table_type = 'BASE TABLE'` restricts to.
  const tableRows = (await pg.query(
    `SELECT table_name FROM information_schema.tables
       WHERE table_schema = 'public' AND table_type = 'BASE TABLE' AND table_name LIKE 'base\\_%' ESCAPE '\\'`,
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

// ---- load the requested packs (if any), in their real requires-pack order --------------------------------------
if (selectedPacks.length) {
  const packSegments = segmentByPack(orderPacks(core, selectedPacks), core, selectedPacks)
    .filter(seg => seg.pack !== core.name)   // core's own segment was already applied above
  await applyPackSegments(packSegments, apply)
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
console.log(requestedPacks.length ? `\nadditivity holds: core unchanged by pack(s) ${requestedPacks.join(', ')}.` : '\nadditivity holds (core-vs-core, no packs given).')
