// Self-certification — the ENGINE differential (#278 increment 6). The fourth selfcert layer, over selfcert.mts
// (accelerated == naive per fiber), selfcert-view.mts (view configs) and selfcert-rows.mts (planRows == rowSql):
// here the two sides are TWO ENGINES evaluating the SAME Expr. pg is the oracle; every other engine must agree
// with it or decline.
//
// This generalizes selfcert-math.mts, which hand-inlined one loop per function. Nothing here is per-function: the
// sweep is driven by base_function_impl, so a new impl row is swept the moment it lands.
//
// The interesting failure is not "ts disagrees with pg" — it is "ts disagrees with pg AND DIDN'T SAY SO". A
// float64 implementation past 2^53 is expected to be wrong; what must never happen is that it returns a
// plausible-looking number instead of declining. Each function's EXACTNESS FRONTIER (the smallest input where ts
// stops answering) is reported, because that number is a property of the catalog worth knowing.
//
//   node --import tsx selfcert-engine.mts [filter]
import {
  close, evaluate, exprFromStatement, extendDb, InexactResult, lowerScalar, makeDb, parseCalc, pgEngine,
  provideCatalog, provideDb, provideEngine, registry, resetRegistry, routerEngine, rowSql, runSql, tsEngine,
  type Expr,
} from './src/index.ts'
import { buildCatalogSnapshot, grantsFor } from '@enumeratio/data/catalog-snapshot'
import { coreBundleHash } from '@enumeratio/data/node'

provideDb(() => makeDb())
const filter = process.argv[2] ?? null

// Build the catalog off THIS connection rather than reading the release artifact. The artifact is generated at
// pack time and gitignored, so certifying against it would mean certifying whether someone had run a build —
// and would go red on every sqlsrc edit until they did.
provideCatalog(async () => ({ snapshot: await buildCatalogSnapshot(runSql, coreBundleHash()), liveHash: coreBundleHash() }))
const reg = await registry()
if (reg.dirty) { console.error(`cannot self-certify: ${reg.dirty}`); process.exit(1) }
const pg = pgEngine()
const ts = tsEngine(reg)
await pg.ready?.()
provideEngine(() => routerEngine([ts, pg]))

let checked = 0
const mismatches: string[] = []
const notes: string[] = []

// ── the domains ───────────────────────────────────────────────────────────────────────────────────────────────────
// Per function, the argument tuples to sweep. Ranges run well past where a float64 result stops being exact, on
// purpose: that boundary is what this file exists to locate. Functions over composite carriers (the Gaussian and
// multicomplex families, permutation_unrank, lehmer_code) are absent because there is no literal syntax for their
// arguments in the calc grammar yet — recorded below rather than silently skipped.
const range = (lo: number, hi: number): number[] => Array.from({ length: hi - lo + 1 }, (_, i) => lo + i)
const pairs = (ns: number[], k: (n: number) => number[]): number[][] => ns.flatMap((n) => k(n).map((x) => [n, x]))
const upTo = (n: number): number[] => range(-1, n + 1)

/** An argument spelled as calc text rather than a bare number — a carrier construction (#289). Kept as text so
 *  the sweep exercises the SAME grammar a user types, constructors and array literals included. */
type Arg = number | string
const gauss = (re: number, im: number): string => `gaussian_integer(${re}, ${im})`
const mc = (cs: number[], m: number): string => `multicomplex([${cs.join(', ')}], ${m})`
const perm = (image: number[]): string => `permutation([${image.join(', ')}])`

/** every permutation of [1..n], in lex order — small n, for the permutation-argument sweeps */
function perms(n: number): number[][] {
  if (n === 0) return [[]]
  const out: number[][] = []
  const walk = (left: number[], acc: number[]) => {
    if (!left.length) { out.push(acc); return }
    for (let i = 0; i < left.length; i++) walk([...left.slice(0, i), ...left.slice(i + 1)], [...acc, left[i]])
  }
  walk(range(1, n), [])
  return out
}

const GAUSS_PTS = pairs(range(-4, 4), () => range(-4, 4))
const MC_VECS: number[][][] = [
  [[2, 3], [5, 7]], [[0, 0], [1, 1]], [[96, 1], [1, 96]], [[2, 3, 4, 5], [5, 7, 1, 2]],
  [[1, 0, 0, 0], [0, 1, 0, 0]], [[48, 49, 50, 51], [96, 95, 94, 93]],
]

const DOMAINS: Record<string, Arg[][]> = {
  catalan_number: range(0, 60).map((n) => [n]),
  little_schroder_number: range(0, 40).map((n) => [n]),
  factorial: range(0, 40).map((n) => [n]),
  bell: range(0, 40).map((n) => [n]),
  fubini: range(0, 30).map((n) => [n]),
  partition_number: range(0, 80).map((n) => [n]),
  double_factorial_odd: range(0, 30).map((n) => [n]),
  multicomplex_popcount: range(0, 30).map((n) => [n]),
  binomial: pairs(range(0, 40), upTo),
  stirling_second: pairs(range(0, 25), upTo),
  stirling1: pairs(range(0, 25), upTo),
  eulerianA: pairs(range(0, 22), upTo),
  integer_partition_k_count: pairs(range(0, 30), upTo),
  gcd: pairs(range(-12, 12), () => range(-12, 12)),
  lcm: pairs(range(-12, 12), () => range(-12, 12)),
  pow: pairs(range(-4, 6), () => range(0, 20)),

  // composite carriers (#289) — arguments built with the calc grammar's own constructors, results printed
  // through the notation_<carrier> twins. These are the rows ts declined outright until it had a printer.
  gaussian_add: GAUSS_PTS.flatMap(([a, b]) => GAUSS_PTS.slice(0, 9).map(([c, d]) => [gauss(a, b), gauss(c, d)])),
  gaussian_mul: GAUSS_PTS.flatMap(([a, b]) => GAUSS_PTS.slice(0, 9).map(([c, d]) => [gauss(a, b), gauss(c, d)])),
  gaussian_neg: GAUSS_PTS.map(([a, b]) => [gauss(a, b)]),
  gaussian_norm: GAUSS_PTS.map(([a, b]) => [gauss(a, b)]),
  multicomplex_add: MC_VECS.map(([a, b]) => [mc(a, 97), mc(b, 97)]),
  multicomplex_mul: MC_VECS.map(([a, b]) => [mc(a, 97), mc(b, 97)]),
  multicomplex_neg: MC_VECS.map(([a]) => [mc(a, 97)]),
  multicomplex_conj: MC_VECS.map(([a]) => [mc(a, 97)]),
  permutation_unrank: [1, 2, 3, 4, 5].flatMap((n) => range(0, Math.min(23, [1, 1, 2, 6, 24, 120][n] - 1)).map((r) => [n, r])),
  composition_from_mask: range(0, 8).flatMap((n) => range(0, Math.max(0, 2 ** Math.max(0, n - 1) - 1)).map((m) => [n, m])),
  inversions: [1, 2, 3, 4].flatMap((n) => perms(n).map((p) => [perm(p)])),
  lehmer_code: [1, 2, 3, 4].flatMap((n) => perms(n).map((p) => [perm(p)])),
}

const call = (fn: string, args: Arg[]): string => `${fn}(${args.join(', ')})`

/** pg's answer for many calls at once — one query per batch, not per case (a 3000-case sweep is otherwise minutes
 *  of round-trips for arithmetic that takes microseconds). */
async function pgBatch(fn: string, _impl: string, cases: Arg[][]): Promise<string[]> {
  const out: string[] = []
  for (let i = 0; i < cases.length; i += 100) {
    const slice = cases.slice(i, i + 100)
    // lower through pg-engine itself rather than splicing text here: the point is to certify the ENGINE's
    // lowering (impl_ref substitution, ROW(...)::carrier construction, ARRAY[...] literals), not a second
    // hand-written one that could agree with ts while both disagree with the database.
    const cols = slice.map((a, n) => `(${lowerScalar(parseCalc(call(fn, a)).select[0])})::text AS c${n}`).join(', ')
    const [row] = await runSql<Record<string, string>>(`SELECT ${cols}`)
    out.push(...slice.map((_, n) => String(row[`c${n}`])))
  }
  return out
}

const tsValue = async (text: string): Promise<{ value?: string; declined?: string }> => {
  try {
    const r = ts.evaluate(parseCalc(text))
    for await (const row of r.rows) return { value: String(Object.values(row)[0]) }
    return { declined: 'no rows' }
  } catch (e) {
    if (e instanceof InexactResult) return { declined: 'inexact' }
    return { declined: (e as Error).message }
  }
}

console.log('── engine differential: ts == pg, or ts declines ────────────────────────────────────────────────')
for (const f of reg.base.functions) {
  if (filter && !f.id.includes(filter)) continue
  const domain = DOMAINS[f.id]
  const tsImpls = reg.impls(f.id, 'ts')
  const pgImpl = reg.impls(f.id, 'pg')[0]
  if (!domain) {
    if (tsImpls.length) notes.push(`${f.id}: no swept domain — ${tsImpls[0].argKinds.join(', ')} arguments have no literal syntax in the calc grammar`)
    continue
  }
  if (!tsImpls.length || !pgImpl) { notes.push(`${f.id}: only one engine implements it (${tsImpls.length ? 'ts' : 'pg'} only) — nothing to diff`); continue }

  const expected = await pgBatch(f.id, pgImpl.implRef, domain)
  const before = mismatches.length
  let agreed = 0, declined = 0
  let frontier: number[] | null = null
  for (const [i, args] of domain.entries()) {
    const text = call(f.id, args)
    const got = await tsValue(text)
    checked++
    if (got.declined === 'inexact') {
      declined++
      if (!frontier) frontier = args
      continue
    }
    if (got.declined) { mismatches.push(`${text}: ts errored — ${got.declined}`); continue }
    if (got.value !== expected[i]) mismatches.push(`${text}: pg=${expected[i]} ts=${got.value} (SILENT disagreement — the exactness guard let it through)`)
    else agreed++
  }
  const exact = reg.impls(f.id, 'ts').some((i) => i.representation === 'bigint' || i.representation === 'numeric')
  const bad = mismatches.length - before
  const mark = declined ? `${agreed} agree, ${declined} declined past ${call(f.id, frontier!)}` : `${agreed} agree`
  console.log(`  ${bad ? '✗' : '✓'} ${f.id.padEnd(28)} ${mark}${bad ? `, ${bad} MISMATCHED` : ''}${exact ? ' · exact twin available' : ''}`)
}

// ── the two grant folds ───────────────────────────────────────────────────────────────────────────────────────────
// grantsFor (TS, in the snapshot) must equal engine_grants() (SQL). Two implementations of one rule, pinned by a
// differential — the same discipline as accelerated == naive, applied to policy resolution.
if (!filter) {
  console.log('── grant resolution: grantsFor(TS) == engine_grants(SQL) ────────────────────────────────────────')
  let pairsChecked = 0, bad = 0
  for (const e of reg.base.engines) {
    for (const c of reg.base.collections) {
      const [r] = await runSql<{ g: string }>(`SELECT engine_grants($1, $2)::text AS g`, [e.id, c.id])
      const sql = r.g.replace(/^\{|\}$/g, '').split(',').filter(Boolean).sort()
      const tsSide = grantsFor(reg.base, e.id, c.id).sort()
      pairsChecked++
      if (JSON.stringify(sql) !== JSON.stringify(tsSide)) { bad++; mismatches.push(`grants ${e.id}/${c.id}: sql=${JSON.stringify(sql)} ts=${JSON.stringify(tsSide)}`) }
    }
  }
  checked += pairsChecked
  console.log(`  ${bad ? '✗' : '✓'} ${pairsChecked - bad}/${pairsChecked} (engine, collection) pairs agree`)
}

// ── the row half through the seam ─────────────────────────────────────────────────────────────────────────────────
// evaluate() must land on exactly what the naive logical statement produces. selfcert-rows already pins
// planRows == rowSql; this closes the last link, Expr → RowQuery → planRows, so the codec cannot drift.
if (!filter) {
  console.log('── the row half: evaluate(Expr) == the naive statement ──────────────────────────────────────────')
  const CASES = [
    { from: 'permutations(size=4)', where: 'descents >= 2' },
    { from: 'permutations(size=0..4)', groupBy: 'size, descents' },
    { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)' },
    { from: 'subsets(3)', select: 'element,cardinality' },
  ]
  for (const c of CASES) {
    const expr: Expr = exprFromStatement(c)
    const { plan, rows } = evaluate(expr, { window: { count: 50 } })
    const got: Record<string, unknown>[] = []
    for await (const r of rows) got.push(r as Record<string, unknown>)
    const p = await plan
    const naive = await runSql<Record<string, unknown>>(await rowSql(c, { count: 50 }, c.select ? { select: c.select } : {}))
    checked++
    const same = JSON.stringify(got.map((r) => Object.values(r).map(String))) === JSON.stringify(naive.map((r) => Object.values(r).map(String)))
    if (!same) mismatches.push(`row half ${c.from}: evaluate() != the naive statement`)
    console.log(`  ${same ? '✓' : '✗'} ${c.from.padEnd(28)} ${got.length} rows via ${p.engine}`)
  }
}

// ── structured extend(), both engines at once ─────────────────────────────────────────────────────────────────────
// A caller that extends BOTH engines owns the equivalence of the two bodies. This case is what makes that
// ownership checkable: extend with a toy identity, assert the two engines agree, then shadow it and assert the
// shadow wins.
if (!filter) {
  console.log('── extend(): a new identity, in both engines at once ────────────────────────────────────────────')
  const extendBad = mismatches.length
  const router = routerEngine([ts, pg])
  await router.extend({
    functions: [{ id: 'triangular', title: 'Triangular number', description: 'T(n) = n(n+1)/2.' }],
    impls: [
      { function: 'triangular', engine: 'pg', implRef: 'triangular', argTypes: ['int'], returnType: 'numeric',
        representation: 'numeric', body: 'CREATE OR REPLACE FUNCTION triangular(n int) RETURNS numeric LANGUAGE sql IMMUTABLE AS $$ SELECT trim_scale((n::numeric * (n + 1)) / 2) $$' },
      { function: 'triangular', engine: 'ts', implRef: 'triangular', argTypes: ['int'], returnType: 'numeric',
        representation: 'bigint', body: (n: number) => (BigInt(n) * BigInt(n + 1)) / 2n },
    ],
  })
  for (const n of [0, 1, 5, 40, 1000]) {
    const [row] = await runSql<{ v: string }>(`SELECT triangular(${n})::text AS v`)
    const got = await tsValue(`triangular(${n})`)
    checked++
    if (got.value !== row.v) mismatches.push(`extend: triangular(${n}) pg=${row.v} ts=${got.value ?? got.declined}`)
  }
  console.log(`  ${extendBad === mismatches.length ? '✓' : '✗'} triangular: ts == pg on the extended identity`)

  await router.extend({
    impls: [{ function: 'triangular', engine: 'ts', implRef: 'triangular', argTypes: ['int'], returnType: 'numeric',
              representation: 'bigint', body: () => 'SHADOWED' }],
  })
  const shadowed = await tsValue('triangular(5)')
  checked++
  if (shadowed.value !== 'SHADOWED') mismatches.push(`extend: the later overlay did not shadow the earlier one (got ${shadowed.value ?? shadowed.declined})`)
  console.log(`  ${shadowed.value === 'SHADOWED' ? '✓' : '✗'} a later overlay shadows an earlier one`)

  await extendDb('CREATE OR REPLACE FUNCTION __selfcert_dirty() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$')
  checked++
  if (ts.can(parseCalc('gcd(4, 6)'))) mismatches.push('a raw extendDb did not make the registry dirty')
  console.log(`  ${ts.can(parseCalc('gcd(4, 6)')) ? '✗' : '✓'} a raw extendDb collapses every non-pg engine to pg`)
}

if (notes.length) {
  console.log('\nnot swept (stated, not skipped silently):')
  for (const n of notes) console.log(`  · ${n}`)
}
console.log(`\nengine self-certification: ${checked} cases, ${mismatches.length} mismatches`)
for (const m of mismatches.slice(0, 40)) console.log(`  ✗ ${m}`)
if (mismatches.length > 40) console.log(`  … and ${mismatches.length - 40} more`)
resetRegistry()
await close()
process.exit(mismatches.length ? 1 : 0)
