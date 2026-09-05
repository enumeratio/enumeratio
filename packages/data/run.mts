// Applies the rebuilt base into a bare PGlite (zero C), runs the example table. Mirrors pg-enumeratio's
// runner. Files apply in `-- requires:` dependency order (toposort, bootstrap first) — the same ordering the
// Vite bundle (index.ts) uses; filenames carry no ordering meaning.
//   node --import tsx run.mts                 # apply all sqlsrc, run examples
//   node --import tsx run.mts scratch.sql     # + apply a candidate file last (in a rolled-back txn)
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import debug from 'debug'
import { orderSqlsrc } from './sqlsrc-order'
import { debugGucSetSql, routeNotice } from './debug-env'

const log = debug('enumeratio:data:run')

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

const dir = join(here, 'sqlsrc')
const candidate = process.argv[2] ? resolve(process.argv[2]) : null
const files = orderSqlsrc(
  readdirSync(dir).filter(f => f.endsWith('.sql'))
    .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') })),
).map(f => `${f.name}.sql`)

const pg = new PGlite()
await pg.waitReady
const debugSetSql = debugGucSetSql()   // lift DEBUG (if it names an enumeratio: namespace) into the session GUC
if (debugSetSql) await pg.exec(debugSetSql)
log('booted pglite (DEBUG=%s)', process.env.DEBUG ?? '')

async function apply(label: string, sql: string) {
  try { await pg.exec(sql) }
  catch (e: any) { console.error(`\n✗ FAILED applying ${label}\n  ${e.message.split('\n')[0]}\n`); await pg.close(); process.exit(1) }
}

for (const f of files) await apply(f, readFileSync(join(dir, f), 'utf8'))

const includeSlow = process.env.EXAMPLES === 'all'   // default gate runs the fast tier; EXAMPLES=all adds the slow one

async function runExamples(): Promise<number> {
  const rows = (await pg.query(
    'SELECT suite, title, passed, expected, actual FROM base_run_examples($1) ORDER BY suite, title',
    [includeSlow],
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
  console.log(`applied ${files.length} sql files, zero C.\n`)
  failed = await runExamples()
}

await pg.close()
if (failed) process.exit(1)
