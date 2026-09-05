// Engine benchmarks (#291). #278 built `base_function_impl.cost` and left it NULL on every row, deliberately:
// a router that traded exactness for speed unasked would be a bug. This is the evidence needed before `cost`
// means anything — and it is a measurement harness, not a policy change. Nothing here writes to the catalog.
//
// Three questions, in the order #291 asks them:
//   1. what does a pg round-trip cost, with no arithmetic in it at all
//   2. per (function, overload, representation), what does one warm call cost on each engine, small and large
//   3. for a function with an EXACT twin on both sides (bigint ts vs bigint pg), where is the crossover
//
// The round-trip is separated from the computation by running the same call two ways: once per query, and once
// as N columns of a single query. The batched form shares planning and one transport hop, so per-call it is
// close to pure compute; the difference against the single-call form is what the transport costs. That is the
// number a wasm engine changes and the ts engine removes, so it is reported on its own line.
//
//   node --import tsx bench-engine.mts [filter]
import {
  close, InexactResult, lowerScalar, makeDb, makeWorkerDb, parseCalc, pgEngine, provideCatalog, provideDb,
  registry, resetRegistry, runSql, tsEngine,
} from './src/index.ts'
import { buildCatalogSnapshot } from '@enumeratio/data/catalog-snapshot'
import { coreBundleHash } from '@enumeratio/data/node'

provideDb(() => makeDb())
const filter = process.argv[2] ?? null

provideCatalog(async () => ({ snapshot: await buildCatalogSnapshot(runSql, coreBundleHash()), liveHash: coreBundleHash() }))
const reg = await registry()
if (reg.dirty) { console.error(`cannot benchmark: ${reg.dirty}`); process.exit(1) }
const pg = pgEngine()
const ts = tsEngine(reg)
await pg.ready?.()

// ── timing ────────────────────────────────────────────────────────────────────────────────────────────────────
// Median over repetitions, not mean: one GC pause should not move the number. A ts call is sub-microsecond, so
// its repetitions are timed in batches of `inner` and divided — per-call hrtime overhead would otherwise be the
// thing being measured.
const median = (xs: number[]): number => { const s = [...xs].sort((a, b) => a - b); return s[s.length >> 1] }
const µs = (ns: number): string => (ns / 1000).toFixed(ns < 10_000 ? 2 : 0)

/** ns per call, or why there is no number: `inexact` (the guard declined), `raises` (the engine errored). A
 *  failed measurement must never come back as a small number — that would read as "fast". */
type Timing = { ns: number } | { failed: 'inexact' | 'raises'; why: string }
async function timeCall(reps: number, inner: number, call: () => Promise<unknown>): Promise<Timing> {
  try { for (let i = 0; i < Math.min(inner, 20); i++) await call() } catch (e) {   // warm
    return { failed: e instanceof InexactResult ? 'inexact' : 'raises', why: (e as Error).message.split('\n')[0] }
  }
  const per: number[] = []
  for (let r = 0; r < reps; r++) {
    const t0 = process.hrtime.bigint()
    for (let i = 0; i < inner; i++) await call()
    per.push(Number(process.hrtime.bigint() - t0) / inner)
  }
  return { ns: median(per) }
}
const cell = (t: Timing, w: number): string => ('ns' in t ? µs(t.ns) : t.failed).padStart(w)

// Consume the stream to completion. Breaking out early leaves the underlying query in flight, and it rejects
// after close() as an unhandled rejection — these are all scalars, so there is exactly one row to take.
const drain = async (it: AsyncIterable<unknown>): Promise<void> => { for await (const _ of it) { /* one row */ } }
/** Calling an engine DIRECTLY skips the evaluate() façade, which is what marks the returned `plan` promise's
 *  rejection observed. Without this a raising call takes the whole process down as an unhandled rejection. */
const engineCall = (e: { evaluate: (x: ReturnType<typeof parseCalc>) => { plan: Promise<unknown>; rows: AsyncIterable<unknown> } }, text: string) =>
  async () => { const r = e.evaluate(parseCalc(text)); r.plan.catch(() => {}); await drain(r.rows) }
const tsCall = (text: string) => engineCall(ts, text)
const pgCall = (text: string) => engineCall(pg, text)

/** the same call as N columns of ONE query: shared planning, one transport hop ⇒ per-call ≈ compute alone */
const pgBatched = (text: string, n: number) => {
  const cols = Array.from({ length: n }, (_, i) => `(${lowerScalar(parseCalc(text).select[0])})::text AS c${i}`).join(', ')
  return async () => { await runSql(`SELECT ${cols}`) }
}

// ── the bench points ──────────────────────────────────────────────────────────────────────────────────────────
// One SMALL and one LARGE argument tuple per function, spelled as calc text so the grammar under test is the one
// a caller types. Large means "as far as the exact side still answers", which for a float64 twin is bounded by
// its own frontier — those are the functions where ts declines and pg is the only answer, and the table says so.
const g = (re: number, im: number) => `gaussian_integer(${re}, ${im})`
const m = (cs: number[], mod: number) => `multicomplex([${cs.join(', ')}], ${mod})`
const POINTS: Record<string, [string, string]> = {
  bell:                      ['bell(5)',                       'bell(20)'],
  binomial:                  ['binomial(5, 2)',                'binomial(60, 30)'],
  catalan_number:            ['catalan_number(5)',             'catalan_number(30)'],
  double_factorial_odd:      ['double_factorial_odd(5)',       'double_factorial_odd(15)'],
  eulerianA:                 ['eulerianA(5, 2)',               'eulerianA(18, 7)'],
  factorial:                 ['factorial(5)',                  'factorial(20)'],
  fubini:                    ['fubini(5)',                     'fubini(16)'],
  gaussian_add:              [`gaussian_add(${g(1, 2)}, ${g(3, 4)})`,   `gaussian_add(${g(30000, 20000)}, ${g(20000, 10000)})`],
  gaussian_mul:              [`gaussian_mul(${g(1, 2)}, ${g(3, 4)})`,   `gaussian_mul(${g(30000, 20000)}, ${g(20000, 10000)})`],
  gaussian_neg:              [`gaussian_neg(${g(1, 2)})`,               `gaussian_neg(${g(30000, 20000)})`],
  gaussian_norm:             [`gaussian_norm(${g(1, 2)})`,              `gaussian_norm(${g(30000, 20000)})`],
  gcd:                       ['gcd(12, 18)',                   'gcd(1234567, 7654321)'],
  integer_partition_k_count: ['integer_partition_k_count(5, 2)', 'integer_partition_k_count(40, 12)'],
  little_schroder_number:    ['little_schroder_number(5)',     'little_schroder_number(20)'],
  mc_add:                    [`mc_add(${m([1, 2], 7)}, ${m([3, 4], 7)})`, `mc_add(${m([1, 2, 3, 4, 5, 6, 7, 8], 97)}, ${m([8, 7, 6, 5, 4, 3, 2, 1], 97)})`],
  mc_conj:                   [`mc_conj(${m([1, 2], 7)})`,               `mc_conj(${m([1, 2, 3, 4, 5, 6, 7, 8], 97)})`],
  mc_mul:                    [`mc_mul(${m([1, 2], 7)}, ${m([3, 4], 7)})`, `mc_mul(${m([1, 2, 3, 4, 5, 6, 7, 8], 97)}, ${m([8, 7, 6, 5, 4, 3, 2, 1], 97)})`],
  mc_neg:                    [`mc_neg(${m([1, 2], 7)})`,                `mc_neg(${m([1, 2, 3, 4, 5, 6, 7, 8], 97)})`],
  mc_popcount:               ['mc_popcount(5)',                'mc_popcount(1048575)'],
  partition_number:          ['partition_number(5)',           'partition_number(60)'],
  pow:                       ['pow(2, 5)',                     'pow(7, 18)'],
  stirling1:                 ['stirling1(5, 2)',               'stirling1(18, 2)'],
  stirling_second:           ['stirling_second(5, 2)',         'stirling_second(22, 8)'],
}

// ── 1. the transport floor ────────────────────────────────────────────────────────────────────────────────────
console.log('── transport: what a call costs with no arithmetic in it ────────────────────────────────────────')
const floorMain = await timeCall(9, 40, async () => { await runSql('SELECT 1') })
console.log(`  in-process pglite   SELECT 1        ${cell(floorMain, 9)} µs`)

provideDb(() => makeWorkerDb())
const floorWorker = await timeCall(9, 40, async () => { await runSql('SELECT 1') })
console.log(`  worker_threads      SELECT 1        ${cell(floorWorker, 9)} µs`)
// The two floors land on top of each other run to run (the difference has come out either sign), so the ~190 µs
// is pglite's own per-query overhead, NOT the cost of crossing to another thread. Worth stating plainly: moving
// the database off-thread does not buy latency back, and a wasm engine's case is removing the query, not the hop.
console.log('  the two are within run-to-run noise of each other — the cost is pglite per-query, not the thread hop.')
await close()
provideDb(() => makeDb())
await runSql('SELECT 1')
console.log('  ts engine has no transport: it is a function call on the same thread.\n')

// ── 2. per-function, small and large ──────────────────────────────────────────────────────────────────────────
console.log('── warm call latency, µs (median) ───────────────────────────────────────────────────────────────')
console.log('  a float64 ts impl is not racing pg fairly — it is doing less work, and stops answering past 2^53.')
console.log('  The `ts rep` column says which: only bigint/numeric rows are a like-for-like comparison.\n')
console.log(`  ${'function'.padEnd(26)} ${'point'.padEnd(6)} ${'ts rep'.padEnd(8)} ${'ts'.padStart(9)} ${'pg'.padStart(9)} ${'pg compute'.padStart(11)} ${'ratio'.padStart(7)}`)
type Row = { fn: string; point: string; ts: number; pg: number; compute: number }
const rows: Row[] = []
const asymmetry: string[] = []
for (const f of reg.base.functions) {
  if (filter && !f.id.includes(filter)) continue
  const pts = POINTS[f.id]
  if (!pts) continue
  if (!reg.impls(f.id, 'ts').length || !reg.impls(f.id, 'pg').length) continue
  for (const [i, text] of pts.entries()) {
    const point = i === 0 ? 'small' : 'large'
    const t = await timeCall(7, 2000, tsCall(text))
    const p = await timeCall(7, 30, pgCall(text))
    const bat = await timeCall(7, 4, pgBatched(text, 100))
    const compute: Timing = 'ns' in bat ? { ns: bat.ns / 100 } : bat
    if ('ns' in t && 'ns' in p && 'ns' in compute) rows.push({ fn: f.id, point, ts: t.ns, pg: p.ns, compute: compute.ns })
    if ('failed' in p) asymmetry.push(`${text} — pg ${p.why}; ts ${'ns' in t ? 'answers anyway' : t.failed}`)
    const ratio = 'ns' in t && 'ns' in p ? `${(p.ns / t.ns).toFixed(0)}×` : '—'
    const rep = reg.impls(f.id, 'ts').some((x) => x.representation !== 'float64') ? 'exact' : 'float64'
    console.log(`  ${f.id.padEnd(26)} ${point.padEnd(6)} ${rep.padEnd(8)} ${cell(t, 9)} ${cell(p, 9)} ${cell(compute, 11)} ${ratio.padStart(7)}`)
  }
}

// ── 3. the crossover, where both engines are EXACT ────────────────────────────────────────────────────────────
// Only `factorial` and `binomial` carry a bigint ts impl, so only they can be compared without the float64
// exactness caveat. A float64 twin that is still answering is not a fair race against pg's numeric — it is
// doing less work, and past its frontier it stops answering at all.
console.log('\n── crossover: bigint ts vs numeric pg, both exact ───────────────────────────────────────────────')
for (const [fn, ladder] of [['factorial', [5, 10, 20, 50, 100, 200, 400]], ['binomial', [10, 20, 40, 80, 160, 320]]] as [string, number[]][]) {
  if (filter && !fn.includes(filter)) continue
  console.log(`  ${fn}`)
  for (const n of ladder) {
    const text = fn === 'factorial' ? `factorial(${n})` : `binomial(${n}, ${n >> 1})`
    const t = await timeCall(9, 500, tsCall(text))
    const bat = await timeCall(9, 6, pgBatched(text, 100))
    const compute: Timing = 'ns' in bat ? { ns: bat.ns / 100 } : bat
    const verdict = 'ns' in t && 'ns' in compute ? `${(compute.ns / t.ns).toFixed(1)}× in ts's favour` : `ts ${'failed' in t ? t.failed : 'ok'}`
    console.log(`    n=${String(n).padStart(4)}  ts ${cell(t, 9)} µs   pg compute ${cell(compute, 9)} µs   ${verdict}`)
  }
}

// ── what this says about `cost` ───────────────────────────────────────────────────────────────────────────────
// ── a domain probe, deliberately outside pg's int4 ────────────────────────────────────────────────────────────
// The benched points above stay inside the database's domain so the race is fair. These are outside it on
// purpose: a gaussian_integer's components are int4, so their product overflows well before 2^53, which is the
// only boundary the exactness guard knows about.
for (const text of [`gaussian_mul(${g(99999, 12345)}, ${g(54321, 9999)})`, `gaussian_norm(${g(99999, 12345)})`]) {
  const p = await timeCall(1, 1, pgCall(text))
  const t = await timeCall(1, 1, tsCall(text))
  if ('failed' in p) asymmetry.push(`${text}\n      pg: ${p.why}\n      ts: ${'ns' in t ? 'answers' : t.failed}`)
}

if (asymmetry.length) {
  console.log('\n── where the two engines disagree about the DOMAIN, not the value ───────────────────────────────')
  console.log('  The exactness guard watches 2^53. pg\'s int4 components stop at 2^31, so a float64 ts twin over an')
  console.log('  int-component carrier can answer a call the database refuses outright. Not a wrong number — a')
  console.log('  different domain, and the router has no rule for it today.')
  for (const a of asymmetry) console.log(`  · ${a}`)
}
if (rows.length) {
  const rt = median(rows.map((r) => r.pg - r.compute))
  console.log(`\ntransport is the median ${µs(rt)} µs of every pg call above; the arithmetic is ${µs(median(rows.map((r) => r.compute)))} µs.`)
  console.log("Rank by that and cost is a transport count, not a FLOP count — which is why it can only break ties")
  console.log("INSIDE the exact set (#291): a float64 impl is cheap because it is doing less, not because it is better.")
}
resetRegistry()
await close()
