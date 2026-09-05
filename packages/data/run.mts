// Applies the rebuilt base into a bare PGlite (zero C), runs the example table. Mirrors pg-enumeratio's
// runner. Files apply in `-- requires:` dependency order (toposort, bootstrap first) — the same ordering the
// Vite bundle (index.ts) uses; filenames carry no ordering meaning.
//   node --import tsx run.mts                    # apply all sqlsrc + every extracted pack, run all examples
//   node --import tsx run.mts scratch.sql         # + apply a candidate file last (in a rolled-back txn)
//   node --import tsx run.mts --packs core        # self-containment probe: core alone, core's examples alone
//   node --import tsx run.mts --packs core,paths  # core + paths' requires-pack closure; core + paths' examples
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import debug from 'debug'
import { applyPackSegments, orderPacks, segmentByPack, type Pack } from './sqlsrc-order.ts'
import { readPacksFromDisk } from './pack-loader.ts'
import { debugGucSetSql, routeNotice } from './debug-env'

const log = debug('enumeratio:data:run')

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

// ---- argv: an optional candidate .sql path, and an optional `--packs a,b` (repeatable-flag style: last wins) ----
const argv = process.argv.slice(2)
let packsArg: string[] | undefined            // undefined = not passed (full profile); [] would mean `--packs` with no value
let candidateArg: string | undefined
for (let i = 0; i < argv.length; i++) {
  if (argv[i] === '--packs') {
    const v = argv[++i]
    packsArg = v ? v.split(',').map(s => s.trim()).filter(Boolean) : []
  } else if (candidateArg === undefined) {
    candidateArg = argv[i]
  }
}
const candidate = candidateArg ? resolve(candidateArg) : null

const sqlsrcDir = join(here, 'sqlsrc')
const packsDir = join(here, 'packs')

const core: Pack = {
  name: 'core',
  requiresPack: [],
  files: readdirSync(sqlsrcDir).filter(f => f.endsWith('.sql'))
    .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(sqlsrcDir, f), 'utf8') })),
}
const discoveredPacks = readPacksFromDisk(packsDir)   // [] today — packs/ doesn't exist until a lane extracts one

// `--packs core` is the self-containment probe: core alone, no pack directory read at all (even one that requires
// nothing). Any other `--packs` list selects those packs' `requires-pack` TRANSITIVE CLOSURE (always excluding
// 'core', which is implicit) — so `--packs trees-graphs` loads trees-graphs + paths + core, but the closure's own
// dependency packs aren't asserted as examples unless also named (see `examplePacks` below).
function closureOf(names: string[]): Pack[] {
  const byName = new Map(discoveredPacks.map(p => [p.name, p] as const))
  const included = new Set<string>()
  const stack = [...names]
  while (stack.length) {
    const n = stack.pop()!
    if (n === 'core' || included.has(n)) continue
    const p = byName.get(n)
    if (!p) throw new Error(`--packs "${n}" not found under packs/ (discovered: ${discoveredPacks.map(d => d.name).join(', ') || '(none)'})`)
    included.add(n)
    stack.push(...p.requiresPack)
  }
  return discoveredPacks.filter(p => included.has(p.name))
}

const loadedPacks: Pack[] =
  packsArg === undefined ? discoveredPacks                                    // full profile: everything on disk
  : packsArg.length === 1 && packsArg[0] === 'core' ? []                      // self-containment probe: core alone
  : closureOf(packsArg)

// which packs' examples base_run_examples should assert — always 'core' (loaded unconditionally), plus exactly the
// requested names (not their transitive requires-pack closure — a dep pack is loaded to satisfy `requires:`, its
// own examples aren't asserted unless also named). `undefined` (full profile) passes NULL through, unchanged.
const examplePacks: string[] | undefined = packsArg === undefined ? undefined : [...new Set(['core', ...packsArg])]

const ordered = orderPacks(core, loadedPacks)
const segments = segmentByPack(ordered, core, loadedPacks)

const pg = new PGlite()
await pg.waitReady
const debugSetSql = debugGucSetSql()   // lift DEBUG (if it names an enumeratio: namespace) into the session GUC
if (debugSetSql) await pg.exec(debugSetSql)
log('booted pglite (DEBUG=%s)', process.env.DEBUG ?? '')

async function apply(label: string, sql: string) {
  try { await pg.exec(sql) }
  catch (e: any) { console.error(`\n✗ FAILED applying ${label}\n  ${e.message.split('\n')[0]}\n`); await pg.close(); process.exit(1) }
}

await applyPackSegments(segments, apply)

const includeSlow = process.env.EXAMPLES === 'all'   // default gate runs the fast tier; EXAMPLES=all adds the slow one

async function runExamples(): Promise<number> {
  const rows = (await pg.query(
    'SELECT suite, title, passed, expected, actual FROM base_run_examples($1, $2) ORDER BY suite, title',
    [includeSlow, examplePacks ?? null],
    { onNotice: routeNotice },   // a gated debug_log/RAISE NOTICE inside an example's SQL routes here, not stdout
  )).rows as any[]
  const failed = rows.filter(r => !r.passed)
  for (const r of failed) console.log(`FAIL [${r.suite}] ${r.title}\n     expected ${r.expected} got ${r.actual}`)
  console.log(`\nexamples: ${rows.length - failed.length}/${rows.length} passed`)
  return failed.length
}

let failed = 0
if (candidate) {
  await pg.exec('BEGIN')
  await apply(`candidate ${candidate}`, readFileSync(candidate, 'utf8'))
  await pg.exec('SET CONSTRAINTS ALL IMMEDIATE')
  failed = await runExamples()
  await pg.exec('ROLLBACK')
  console.log('\n(candidate rolled back — the baseline is unchanged)')
} else {
  const fileCount = ordered.length
  console.log(
    packsArg === undefined
      ? `applied ${fileCount} sql files, zero C.\n`
      : `applied ${fileCount} sql files (packs: ${packsArg.length ? packsArg.join(', ') : '(none, core only)'}), zero C.\n`,
  )
  failed = await runExamples()
}

await pg.close()
if (failed) process.exit(1)
