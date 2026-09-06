// Rank the example suite by per-example wall time — the "what is my gate spending time on?" tool. Boots one
// PGlite, applies core + every extracted pack (same load path as run.mts), then runs each example INDIVIDUALLY
// with timing and prints the slowest, a per-suite rollup, and a per-pack rollup. Use it to decide what to move to
// the `slow` tier (example-tiers.sql) or where an accel/kernel is worth optimizing. Read-only; changes nothing.
//   node --import tsx profile-examples.mts               # fast-tier examples (what the default gate runs)
//   node --import tsx profile-examples.mts --all         # include the `slow` tier too (what a CI/pre-merge run runs)
//   node --import tsx profile-examples.mts --top 60      # show N slowest (default 40)
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import { applyPackSegments, orderPacks, segmentByPack, type Pack } from './sqlsrc-order.ts'
import { readPacksFromDisk } from './pack-loader.ts'

const argv = process.argv.slice(2)
const includeSlow = argv.includes('--all')
const topN = (() => { const i = argv.indexOf('--top'); return i >= 0 && argv[i + 1] ? Math.max(1, Number(argv[i + 1])) : 40 })()

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

const core: Pack = {
  name: 'core', requiresPack: [],
  files: readdirSync(join(here, 'sqlsrc')).filter(f => f.endsWith('.sql'))
    .map(f => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(here, 'sqlsrc', f), 'utf8') })),
}
const packs = readPacksFromDisk(join(here, 'packs'))
const ordered = orderPacks(core, packs)
const segments = segmentByPack(ordered, core, packs)

const pg = new PGlite()
await pg.waitReady
const tApply = performance.now()
await applyPackSegments(segments, async (label, sql) => {
  try { await pg.exec(sql) } catch (e: any) { console.error(`✗ apply ${label}: ${e.message.split('\n')[0]}`); process.exit(1) }
})
console.log(`apply: ${((performance.now() - tApply) / 1000).toFixed(1)}s (${ordered.length} files)`)

const ex = (await pg.query(
  `SELECT suite, title, kind, sql, pack FROM base_example WHERE ($1 OR NOT slow) ORDER BY suite, title`,
  [includeSlow],
)).rows as { suite: string; title: string; kind: string; sql: string; pack: string }[]

const timings: { ms: number; suite: string; title: string; pack: string }[] = []
for (const e of ex) {
  const s = performance.now()
  try { if (e.kind === 'ok') await pg.exec(e.sql); else await pg.query(e.sql) } catch { /* time only; run.mts owns pass/fail */ }
  timings.push({ ms: performance.now() - s, suite: e.suite, title: e.title, pack: e.pack })
}
timings.sort((a, b) => b.ms - a.ms)
const total = timings.reduce((s, t) => s + t.ms, 0)
console.log(`exec: ${(total / 1000).toFixed(1)}s over ${ex.length} ${includeSlow ? 'total' : 'fast-tier'} examples\n`)

console.log(`TOP ${topN} SLOWEST (ms · % · suite — title [pack]):`)
let cum = 0
for (const t of timings.slice(0, topN)) {
  cum += t.ms
  console.log(`  ${t.ms.toFixed(0).padStart(6)}  ${(100 * t.ms / total).toFixed(1).padStart(4)}%  ${t.suite} — ${t.title}  [${t.pack}]`)
}
console.log(`  ── top ${topN} = ${(100 * cum / total).toFixed(1)}% of exec time`)

const roll = (key: (t: typeof timings[number]) => string, label: string, n = 20) => {
  const by = new Map<string, number>()
  for (const t of timings) by.set(key(t), (by.get(key(t)) ?? 0) + t.ms)
  console.log(`\nTOP ${n} ${label} BY TOTAL:`)
  for (const [k, ms] of [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, n)) console.log(`  ${(ms / 1000).toFixed(2).padStart(7)}s  ${k}`)
}
roll(t => t.suite, 'SUITES')
roll(t => t.pack, 'PACKS', 12)
await pg.close()
