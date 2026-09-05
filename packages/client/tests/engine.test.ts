// The engine seam over a real core (#278). Two claims:
//   1. pg-engine's row half is a CALL-THROUGH — its plan and rows are what planRows already returns, byte for byte.
//      That is the guarantee that makes the new path safe to add: nothing about the accelerated planner moved.
//   2. an AbortSignal really interrupts, on a backend that can interrupt. The node worker is that backend: a tight
//      enumeration ignores statement_timeout, so terminate() is the only thing that stops it.
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildCatalogSnapshot } from '@enumeratio/data/catalog-snapshot'
import { coreBundleHash } from '@enumeratio/data/node'
import {
  cancelDb, close, evaluate, extendDb, exprFromStatement, fnRef, InexactResult, provideCatalog, makeDb, makeWorkerDb, parseCalc,
  lowerScalar, pgEngine, planRows, provideDb, provideEngine, registry, Registry, resetRegistry, routerEngine, runSql,
  setQueryTimeout, tsEngine, type Expr, type RowQuery,
} from '../src/index.ts'

const collect = async <T>(it: AsyncIterable<T>): Promise<T[]> => { const o: T[] = []; for await (const x of it) o.push(x); return o }

/** Build the catalog snapshot off the connection this test already has, instead of reading the release artifact.
 *  The artifact is generated at pack time and gitignored, so a suite that read it would be testing whether
 *  someone had run a build — and would go red on every sqlsrc edit until they did. */
const useLiveCatalog = () =>
  provideCatalog(async () => ({ snapshot: await buildCatalogSnapshot(runSql, coreBundleHash()), liveHash: coreBundleHash() }))

describe('pg-engine · the row half is planRows, unchanged', () => {
  // eagerly, so the Db factory is registered before anything calls a legacy export (see pgEngine's docstring)
  const pg = pgEngine(() => makeDb())
  beforeAll(() => { provideEngine(() => pg) })
  afterAll(async () => { await close() })

  const CASES: { id: string; q: RowQuery; select?: string }[] = [
    { id: 'elements · restriction', q: { from: 'permutations(size=4)', where: 'descents >= 2' } },
    { id: 'elements · select list', q: { from: 'permutations(size=4)' }, select: 'element,descents' },
    { id: 'fibers · band', q: { from: 'permutations(size=0..5)', groupBy: 'size' } },
    { id: 'distribution · triangle', q: { from: 'permutations(size=0..4)', groupBy: 'size, descents' } },
    { id: 'rollup', q: { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)' } },
  ]

  it.each(CASES.map((c) => [c.id, c] as const))('%s — plan.sql and rows match planRows', async (_id, c) => {
    const w = { count: 20 }
    const sel = c.select ? { select: c.select } : {}
    const direct = await planRows(c.q, w, sel)
    const { plan, rows } = evaluate(exprFromStatement({ ...c.q, ...(c.select ? { select: c.select } : {}) }), { window: w })
    const p = await plan
    expect(p.sql).toBe(direct.sql)
    expect(p.archetype).toBe(direct.archetype)
    expect(p.columns).toEqual(direct.columns)
    expect(p.total).toEqual(direct.total)
    expect(p.engine).toBe('pg')
    expect(await collect(rows)).toEqual(direct.rows)
  })

  it('a construction-FROM evaluates through the seam, resolved by the row half as it always was', async () => {
    const q = { from: 'maps_of(fin(3), fin(2))' }
    const w = { count: 5 }
    const direct = await planRows(q, w, {})
    const { plan, rows } = evaluate(exprFromStatement(q), { window: w })
    expect((await plan).sql).toBe(direct.sql)
    expect(await collect(rows)).toEqual(direct.rows)
  })

  it('a bare literal is a legal scalar expression — pg claims it and prints it', async () => {
    const e = pgEngine()
    await e.ready?.()
    expect(e.can({ select: [{ kind: 'lit', value: 5 }] })).toBe(true)
    const { plan } = e.evaluate({ select: [{ kind: 'lit', value: 5 }] })
    expect((await plan).sql).toBe('SELECT (5)::text AS "column1"')
  })
})

describe('cancel · the node worker is the backend that can actually interrupt', () => {
  beforeAll(() => { setQueryTimeout(0); provideDb(() => makeWorkerDb()) })   // 0 = no watchdog, so the abort is ours
  afterAll(async () => { await close(); setQueryTimeout(30_000) })

  it('cancelDb() kills a running query and the next one still works', async () => {
    await runSql('SELECT 1')                       // boot the worker before timing anything
    const slow = runSql('SELECT pg_sleep(30)')
    const rejected = slow.then(() => 'resolved', (e: Error) => e.message)
    expect(await cancelDb()).toBe(true)
    expect(await rejected).toMatch(/cancelled|terminated/)
    const [r] = await runSql<{ n: number }>('SELECT 1 AS n')   // respawns
    expect(Number(r.n)).toBe(1)
  })

  it('an in-process PGlite reports that it cannot interrupt, rather than pretending', async () => {
    await close()
    provideDb(() => makeDb())
    await runSql('SELECT 1')
    expect(await cancelDb()).toBe(false)
  })
})

describe('ts-engine · capability is data, and correctness beats speed', () => {
  let reg: Awaited<ReturnType<typeof registry>>
  let ts: ReturnType<typeof tsEngine>
  let pg: ReturnType<typeof pgEngine>
  let router: ReturnType<typeof routerEngine>

  beforeAll(async () => {
    resetRegistry()
    pg = pgEngine(() => makeDb())
    useLiveCatalog()
    reg = await registry()
    ts = tsEngine(reg)
    router = routerEngine([ts, pg])
    provideEngine(() => router)
  })
  afterAll(async () => { await close(); resetRegistry() })

  const value = async (e: ReturnType<typeof tsEngine>, text: string): Promise<string> => {
    const r = e.evaluate(parseCalc(text))
    const rows: Record<string, unknown>[] = []
    for await (const row of r.rows) rows.push(row as Record<string, unknown>)
    return String(Object.values(rows[0])[0])
  }

  it('the snapshot is fresh — otherwise nothing below is testing what it claims', () => {
    expect(reg.dirty).toBeNull()
    expect(reg.base.functions.length).toBeGreaterThanOrEqual(28)
  })

  it('ts == pg for every curated function with a printable ts implementation', async () => {
    // one small, in-domain call per function, derived from its impl row's argument kinds — no per-function code
    const args: Record<string, number[]> = {
      catalan_number: [6], little_schroder_number: [5], factorial: [10], binomial: [10, 4], bell: [8],
      fubini: [6], stirling_second: [7, 3], partition_number: [12], gcd: [12, 18], lcm: [4, 6], pow: [3, 5],
      double_factorial_odd: [6], gaussian_norm: [0], multicomplex_popcount: [23], inversions: [0], stirling1: [6, 3],
      eulerianA: [6, 2], integer_partition_k_count: [10, 3],
    }
    let checked = 0
    for (const f of reg.base.functions) {
      const a = args[f.id]
      if (!a) continue
      const text = `${f.id}(${a.join(', ')})`
      const expr = parseCalc(text)
      if (!ts.can(expr)) continue
      checked++
      const tsValue = await value(ts, text)
      if (!pg.can(expr)) { expect(f.id).toBe('lcm'); continue }   // lcm is the one identity pg has no impl for
      expect([text, tsValue]).toEqual([text, await value(pg, text)])
    }
    expect(checked).toBeGreaterThanOrEqual(15)
  })

  it('prefers the exact implementation over the fast one, unasked', async () => {
    // factorial has a float64 ts impl and a bigint one; the bigint answer is what pg says at any magnitude
    const impl = reg.resolveImpl('factorial', 'ts', ['int'])
    expect(impl?.representation).toBe('bigint')
    expect(await value(ts, 'factorial(20)')).toBe(await value(pg, 'factorial(20)'))
    expect(reg.resolveImpl('factorial', 'ts', ['int'], 'float64')?.implRef).toBe('factorial')
  })

  it('refuses to print a float64 near-miss, and the router falls through to the oracle', async () => {
    // bell has only a float64 ts twin; bell(30) is far past 2^53
    expect(reg.impls('bell', 'ts').map((i) => i.representation)).toEqual(['float64'])
    expect(ts.can(parseCalc('bell(30)'))).toBe(true)
    await expect(value(ts, 'bell(30)')).rejects.toBeInstanceOf(InexactResult)

    const { plan, rows } = router.evaluate(parseCalc('bell(30)'))
    const out: Record<string, unknown>[] = []
    for await (const row of rows) out.push(row as Record<string, unknown>)
    expect((await plan).engine).toBe('pg')
    expect(String(Object.values(out[0])[0])).toBe(await value(pg, 'bell(30)'))
    expect(await value(ts, 'bell(20)')).toBe(await value(pg, 'bell(20)'))   // inside 2^53, ts answers
  })

  it('lcm is curated with no pg implementation — pg declines, ts answers, the router says so', async () => {
    const e = parseCalc('lcm(4, 6)')
    expect(pg.can(e)).toBe(false)
    expect(pg.why(e)).toMatch(/no pg implementation of lcm/)
    expect(ts.can(e)).toBe(true)
    const { plan } = router.evaluate(e)
    const p = await plan
    expect(p.engine).toBe('ts')
    expect(p.impl).toBe('lcm_int')
  })

  it('an uncurated name is not pg’s to refuse — the registry has no authority over it', async () => {
    const e = parseCalc('cardinality(permutations(4))')
    expect(reg.curated('cardinality')).toBe(false)
    expect(pg.can(e)).toBe(true)
    expect(ts.can(e)).toBe(false)
    expect(ts.why(e)).toMatch(/not a registered function/)
    expect(await value(pg, 'cardinality(permutations(4))')).toBe('24')
  })

  it('ts declines a composite result rather than inventing a spelling for it', () => {
    const e: Expr = { select: [{ kind: 'apply', fn: fnRef('gaussian_add'), args: [{ kind: 'lit', value: 1 }, { kind: 'lit', value: 2 }] }] }
    expect(ts.can(e)).toBe(false)
    expect(ts.why(e)).toMatch(/no ts implementation|no printer/)
  })

  it('the row half is denied by the missing enumerator, before any grant is consulted', () => {
    const rows = exprFromStatement({ from: 'permutations(4)', select: 'element' })
    expect(ts.can(rows)).toBe(false)
    expect(ts.why(rows)).toMatch(/no enumerator for permutations/)
    // and with NO select at all — the archetype's default columns, which the per-column basket loop would
    // otherwise wave through on a technicality (selfcert-engine caught ts answering a grouped query this way)
    expect(ts.can(exprFromStatement({ from: 'permutations(size=0..4)', groupBy: 'size, descents' }))).toBe(false)
  })

  it('capability is a GRANT first, then an impl row — revoke the grant and the impl no longer matters', () => {
    const e = parseCalc('gcd(12, 18)')
    expect(ts.can(e)).toBe(true)

    // same registry, same impl rows, one grant removed: ts stops claiming its own arithmetic. Widening or
    // narrowing an engine is a data change, never an edit to ts-engine.ts.
    const revoked = new Registry({ ...reg.base, grants: reg.base.grants.filter((g) => !(g.engine === 'ts' && g.columnGroup === 'scalar_math')) }, null)
    const ts2 = tsEngine(revoked)
    expect(ts2.can(e)).toBe(false)
    expect(ts2.why(e)).toMatch(/not granted "scalar_math"/)
    expect(revoked.impls('gcd', 'ts')).toHaveLength(1)   // the mechanism is still there; the permission is not
  })

  it('a raw extendDb marks the registry dirty, and ts stops claiming anything', async () => {
    expect(ts.can(parseCalc('gcd(12, 18)'))).toBe(true)
    await extendDb('CREATE OR REPLACE FUNCTION __engine_dirty_probe() RETURNS int LANGUAGE sql AS $$ SELECT 1 $$')
    expect(reg.dirty).toMatch(/extended with raw SQL/)
    expect(ts.can(parseCalc('gcd(12, 18)'))).toBe(false)
    expect(pg.can(parseCalc('gcd(12, 18)'))).toBe(true)
  })
})

describe('composite carriers · ts answers what it can print, and declines what it cannot', () => {
  let reg: Awaited<ReturnType<typeof registry>>
  let ts: ReturnType<typeof tsEngine>
  let pg: ReturnType<typeof pgEngine>

  beforeAll(async () => {
    resetRegistry()
    pg = pgEngine(() => makeDb())
    useLiveCatalog()
    reg = await registry()
    ts = tsEngine(reg)
  })
  afterAll(async () => { await close(); resetRegistry() })

  const value = async (e: ReturnType<typeof tsEngine>, text: string): Promise<string> => {
    const r = e.evaluate(parseCalc(text))
    for await (const row of r.rows) return String(Object.values(row)[0])
    throw new Error('no rows')
  }

  it('builds a composite argument from the calc grammar and agrees with pg', async () => {
    for (const text of [
      'gaussian_add(gaussian_integer(2, 3), gaussian_integer(1, -4))',
      'gaussian_mul(gaussian_integer(2, 3), gaussian_integer(1, -4))',
      'gaussian_norm(gaussian_integer(2, 3))',
      'multicomplex_mul(multicomplex([2, 3, 4, 5], 97), multicomplex([5, 7, 1, 2], 97))',
      'inversions(permutation([2, 4, 1, 3]))',
    ]) expect([text, await value(ts, text)]).toEqual([text, await value(pg, text)])
  })

  it('prints a composite RESULT through the notation twin, not through String()', async () => {
    // the ±1 coefficient cases are exactly where a naive interpolation would say 3+-1i
    expect(await value(ts, 'gaussian_add(gaussian_integer(2, 3), gaussian_integer(1, -4))')).toBe('3-i')
    expect(await value(ts, 'gaussian_neg(gaussian_integer(0, 1))')).toBe('-i')
    expect(await value(ts, 'multicomplex_add(multicomplex([2, 3], 97), multicomplex([5, 7], 97))')).toBe('7 + 10j1')
    expect(await value(ts, 'permutation_unrank(4, 5)')).toBe('1432')
    expect(await value(ts, 'composition_from_mask(5, 6)')).toBe('2+1+2')
  })

  it('pg lowers a carrier construction to ROW(...)::carrier, arrays included', () => {
    expect(lowerScalar(parseCalc('gaussian_norm(gaussian_integer(2, 3))').select[0]))
      .toBe('gaussian_norm(ROW(2, 3)::gaussian_integer)')
    expect(lowerScalar(parseCalc('multicomplex_neg(multicomplex([2, 3], 97))').select[0]))
      .toBe('multicomplex_neg(ROW(ARRAY[2, 3], 97)::multicomplex)')
  })

  it('a carrier construction is checked against its declared fields', () => {
    expect(ts.why(parseCalc('gaussian_integer(1)'))).toMatch(/takes 2 fields \(re, im\); got 1/)
  })

  it('lehmer_code has a ts twin: both sides drop the always-0 trailing entry (#293)', () => {
    expect(reg.impls('lehmer_code', 'ts')).toHaveLength(1)
    expect(reg.impls('lehmer_code', 'pg')).toHaveLength(1)
    expect(ts.why(parseCalc('lehmer_code(permutation([2, 4, 1, 3]))'))).toBeUndefined()
  })
})
