// Property-based (QuickCheck-style) verification harness (issue #294) — the SAMPLING sibling of selfcert.mts's
// exhaustive-first-N differential. Most collections are INFINITE, and element_at-vs-sequential is O(N²) per fiber
// for a generic-unrank collection, so an exhaustive sweep never finishes on the whole catalog. This samples instead
// (QuickCheck / Lean4 SlimCheck in spirit): draw K random (fiber, rank) points per collection and check a handful of
// properties that must hold at EVERY point, not just the first N.
//
// THE GENERATOR: unrank(handle, r) for a random rank r ∈ [0, cardinality) is a uniform random element — for a graded
// (possibly infinite) collection, first pick a random bounded fiber (random grade coords within a size cap), then a
// random rank within it (capped, since element_at/unrank can be O(rank) for a recurrence-based accel).
//
// THE PROPERTIES (skipped, not failed, when a collection lacks the capability):
//   1. round-trip     rank(unrank(h, r)) == r, and it renders (universal — unrank always exists, accel or scan)
//   2. accel==naive   render(element_at(fiber, r)) == the r-th of elements(fiber) in order   (needs fiber_unrank)
//   3. count          cardinality(h) == count(elements(h))  on a bounded, capped fiber        (needs fiber_count)
//   4. membership     contains(h, (unrank(h, r)).value) holds for its own sampled element     (needs contains)
//   5. order          element_at(r) < element_at(r+1) in the carrier's total order             (tried; skipped if
//                     the carrier has no `<`, detected by catching "operator does not exist")
//
// THE SHRINKER: on a failure, shrink r toward 0 within the same fiber (linear scan — bounded by the sampled r, which
// is itself capped), then try smaller grade coordinates (smaller n, every fiber at that n, probed at r=0) — a
// best-effort walk down the rank total order + the grade lattice toward a minimal repro, not an exhaustive search.
//
// SEEDING: a tiny deterministic PRNG (mulberry32) seeded from argv/env/Date.now(), printed up front. Any failure
// prints the exact seed + (collection, fiber, rank, property) needed to replay it deterministically.
//
//   node --import tsx quickcheck.mts                 # sample every collection with a fresh seed
//   node --import tsx quickcheck.mts perm            # only collections whose id contains "perm"
//   node --import tsx quickcheck.mts perm 123456      # reproduce a specific run (filter + seed)
//   QUICKCHECK_POINTS=5 node --import tsx quickcheck.mts  # more sampled points per collection (default 2)
import { readdirSync, readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createRequire } from 'node:module'
import debug from 'debug'
import { orderSqlsrc } from './sqlsrc-order'
import { debugGucSetSql, routeNotice } from './debug-env'

const log = debug('enumeratio:data:quickcheck')

const here = dirname(fileURLToPath(import.meta.url))
const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

// Budget knobs — small by design (seconds, not minutes): this is a sampling smoke test, not the exhaustive oracle.
const NMAX = Number(process.env.QUICKCHECK_NMAX ?? 8)            // grade-1 size sampled from [0, NMAX] (mirrors selfcert)
const RANK_CAP = Number(process.env.QUICKCHECK_RANK_CAP ?? 300)  // largest rank sampled when a direct fiber_unrank accel exists (O(1)/O(rank) formula — cheap even at 300, matching selfcert's CAP_UNRANK)
// SCAN_RANK_CAP: largest rank sampled when there's NO accel and unrank(handle, r) falls back to scanning the floor.
// isScanSafe (below) only guards against a floor that materializes its WHOLE fiber before slicing (unbounded cost
// regardless of r) — it does nothing about a floor that's merely slow-per-candidate (a restriction's scan_factor
// over-scan calling a nontrivial predicate once per candidate). Depth 300 there was measured to cost SECONDS per
// point on plain arithmetic-sequence restrictions (abundant/achilles numbers); this is the actual "seconds not
// minutes" budget knob for the common case (no accel, most of the catalog's number-theoretic sequences).
const SCAN_RANK_CAP = Number(process.env.QUICKCHECK_SCAN_RANK_CAP ?? 20)
const CAP_COUNT = Number(process.env.QUICKCHECK_CAP_COUNT ?? 20_000) // largest fiber enumerated for the count property
const POINTS = Number(process.env.QUICKCHECK_POINTS ?? 2)         // sampled (fiber, rank) points per collection
const STMT_TIMEOUT = '8s'

const filter = process.argv[2] || null
const seed = ((process.argv[3] ? Number(process.argv[3]) : Number(process.env.QUICKCHECK_SEED ?? Date.now())) >>> 0)

// mulberry32 — a tiny, deterministic, lib-free PRNG. Same seed ⇒ same stream ⇒ same sampled points, forever.
function mulberry32(a: number) {
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
const rng = mulberry32(seed)
const randInt = (n: number) => (n <= 0 ? 0 : Math.min(n - 1, Math.floor(rng() * n)))

console.log(`quickcheck seed=${seed}${filter ? ` filter=${filter}` : ''} (points/coll=${POINTS} nmax=${NMAX} rankcap=${RANK_CAP})`)

const dir = join(here, 'sqlsrc')
const files = orderSqlsrc(
  readdirSync(dir).filter((f) => f.endsWith('.sql')).map((f) => ({ name: f.replace(/\.sql$/, ''), content: readFileSync(join(dir, f), 'utf8') })),
).map((f) => `${f.name}.sql`)

const pg = new PGlite()
await pg.waitReady
for (const f of files) {
  try { await pg.exec(readFileSync(join(dir, f), 'utf8')) }
  catch (e: any) { console.error(`\n✗ FAILED applying ${f}\n  ${e.message.split('\n')[0]}\n`); await pg.close(); process.exit(1) }
}

await pg.exec(`SET statement_timeout = '${STMT_TIMEOUT}'`)
const debugSetSql = debugGucSetSql()
if (debugSetSql) await pg.exec(debugSetSql)
log('booted pglite (DEBUG=%s)', process.env.DEBUG ?? '')
const q = async <T = any,>(sql: string): Promise<T[]> => (await pg.query(sql, [], { onNotice: routeNotice })).rows as T[]
const regproc = async (sig: string): Promise<boolean> =>
  !!(await q<{ x: boolean }>(`SELECT to_regprocedure('${sig}') IS NOT NULL AS x`))[0]?.x
const isFinite_ = (s: string | null) => s != null && s !== 'Infinity' && s !== 'NaN'
const errMsg = (e: any) => String(e?.message ?? e).split('\n')[0]
const parseAddr = (addrText: string): string[] => {
  const inner = addrText.replace(/^\{|\}$/g, '')
  return inner === '' ? [] : inner.split(',')
}

type CheckResult = { status: 'pass' | 'fail' | 'skip'; detail?: string }
type Caps = { hasCount: boolean; hasUnrank: boolean; hasContains: boolean }
type CheckFn = (pointHandle: string, r: number | null) => Promise<CheckResult>

// ---- the five properties — each self-contained: derives whatever it needs from `pointHandle` (a fully-bound
// handle addressing exactly ONE fiber) and returns pass/fail/skip. r is null for the rank-independent count check. ----

function mkCheckRoundTrip(): CheckFn {
  return async (pointHandle, r) => {
    if (r == null) return { status: 'skip', detail: 'no rank sampled (empty fiber)' }
    try {
      const row = (await q<{ rank_ok: boolean | null; has_render: boolean | null }>(
        `SELECT rank(unrank(${pointHandle}, ${r}::rank_index)) = ${r}::rank_index AS rank_ok,
                render(unrank(${pointHandle}, ${r}::rank_index)) IS NOT NULL AS has_render`))[0]
      if (row?.rank_ok == null) return { status: 'skip', detail: 'unrank returned no element at r' }
      return row.rank_ok && row.has_render ? { status: 'pass' } : { status: 'fail', detail: `rank_ok=${row.rank_ok} has_render=${row.has_render}` }
    } catch (e: any) { return { status: 'skip', detail: errMsg(e) } }
  }
}

function mkCheckAccelNaive(caps: Caps): CheckFn {
  return async (pointHandle, r) => {
    if (!caps.hasUnrank) return { status: 'skip', detail: 'no unrank accel (fiber_unrank)' }
    if (r == null) return { status: 'skip', detail: 'no rank sampled (empty fiber)' }
    try {
      const row = (await q<{ ok: boolean | null }>(
        `SELECT (render(element_at((SELECT f FROM fibers(${pointHandle}) f), ${r}::rank_index))
                 IS NOT DISTINCT FROM
                 (SELECT render(e) FROM elements((SELECT f FROM fibers(${pointHandle}) f), ${r + 1}) e ORDER BY (e).rank LIMIT 1 OFFSET ${r})) AS ok`))[0]
      if (row?.ok == null) return { status: 'skip', detail: 'no element at r' }
      return row.ok ? { status: 'pass' } : { status: 'fail', detail: 'render(element_at(r)) != r-th of elements()' }
    } catch (e: any) { return { status: 'skip', detail: errMsg(e) } }
  }
}

function mkCheckCount(caps: Caps): CheckFn {
  return async (pointHandle, _r) => {
    if (!caps.hasCount) return { status: 'skip', detail: 'no count accel (fiber_count)' }
    try {
      const row = (await q<{ closed: string | null; enumerated: string | null }>(
        `SELECT cardinality(${pointHandle})::text AS closed,
                CASE WHEN cardinality(${pointHandle}) >= 0 AND cardinality(${pointHandle}) <= ${CAP_COUNT}
                     THEN (SELECT count(*)::text FROM elements(${pointHandle}, ${CAP_COUNT + 1}) v) END AS enumerated`))[0]
      if (!isFinite_(row.closed) || row.enumerated == null) return { status: 'skip', detail: '∞ / unknown / too-big to enumerate' }
      return row.closed === row.enumerated ? { status: 'pass' } : { status: 'fail', detail: `closed=${row.closed} enumerated=${row.enumerated}` }
    } catch (e: any) { return { status: 'skip', detail: errMsg(e) } }
  }
}

function mkCheckMembership(caps: Caps): CheckFn {
  return async (pointHandle, r) => {
    if (!caps.hasContains) return { status: 'skip', detail: 'no contains fn' }
    if (r == null) return { status: 'skip', detail: 'no rank sampled (empty fiber)' }
    try {
      const row = (await q<{ ok: boolean | null }>(
        `SELECT contains(${pointHandle}, (unrank(${pointHandle}, ${r}::rank_index)).value) AS ok`))[0]
      if (row?.ok == null) return { status: 'skip', detail: 'contains unknown (semi-decidable ceiling)' }
      return row.ok ? { status: 'pass' } : { status: 'fail', detail: 'contains(h, its own sampled element) = false' }
    } catch (e: any) { return { status: 'skip', detail: errMsg(e) } }
  }
}

function mkCheckOrder(): CheckFn {
  return async (pointHandle, r) => {
    if (r == null) return { status: 'skip', detail: 'no rank sampled (empty fiber)' }
    try {
      const row = (await q<{ lo: any; hi: any; lt: boolean | null }>(
        `SELECT e1.v AS lo, e2.v AS hi, (e1.v < e2.v) AS lt
           FROM (SELECT (unrank(${pointHandle}, ${r}::rank_index)).value AS v) e1,
                (SELECT (unrank(${pointHandle}, ${r + 1}::rank_index)).value AS v) e2`))[0]
      if (row?.lo == null || row?.hi == null) return { status: 'skip', detail: 'r+1 out of range' }
      return row.lt ? { status: 'pass' } : { status: 'fail', detail: 'element_at(r) NOT < element_at(r+1)' }
    } catch (e: any) {
      const msg = errMsg(e)
      if (/operator does not exist/i.test(msg)) return { status: 'skip', detail: 'carrier has no total order (<)' }
      return { status: 'skip', detail: msg }
    }
  }
}

// ---- shrinking: minimize a failing (fiber, rank) toward the rank total order + the grade lattice ----

async function shrinkRankOnly(pointHandle: string, fn: CheckFn, r: number): Promise<number> {
  for (let cand = 0; cand < r; cand++) {
    const res = await fn(pointHandle, cand)
    if (res.status === 'fail') return cand
  }
  return r
}

// isScanSafe: is it safe to run a naive elements()-based scan against this fiber? True when the collection has a
// direct fiber_unrank (never touches the naive floor at all), OR the fiber's cardinality is unknown/infinite (the
// only way to check those IS a capped scan), OR it's finite but small. A finite fiber ABOVE the cap with no accel
// is refused — some floors (e.g. alternating_sign_matrices' `ORDER BY … LIMIT` over a recursive CTE) can't push the
// LIMIT below the ORDER BY, so they materialize the WHOLE fiber before slicing regardless of how small a limit is
// requested; querying `elements(f, 1)` on such a floor costs the same as enumerating all of fiber_count(f). Mirrors
// selfcert's identical guard on its element_at-vs-sequential check (`cardinality(f) <= CAP_UNRANK` or ∞/unknown).
async function isScanSafe(pointHandle: string, caps: Caps): Promise<boolean> {
  if (caps.hasUnrank) return true
  try {
    const row = (await q<{ card: string | null }>(`SELECT cardinality(${pointHandle})::text AS card`))[0]
    const cardNum = row?.card == null || row.card === 'infinity' ? Infinity : Number(row.card)
    return !Number.isFinite(cardNum) || cardNum <= RANK_CAP
  } catch { return false }
}

async function shrinkFiber(collId: string, gradeCount: number, fn: CheckFn, n: number | null, needsRank: boolean, caps: Caps): Promise<{ n: number; addr: string; r: number | null } | null> {
  if (gradeCount === 0 || n == null) return null
  for (let n2 = 0; n2 < n; n2++) {
    let addrRows: { addr: string }[]
    try { addrRows = await q<{ addr: string }>(`SELECT fiber_address(f)::text AS addr FROM fibers(${collId}(${n2})) f ORDER BY fiber_address(f)`) }
    catch { continue }
    for (const row of addrRows) {
      const vals = parseAddr(row.addr)
      const ph = vals.length ? `${collId}(${vals.join(',')})` : `${collId}()`
      if (!(await isScanSafe(ph, caps))) continue   // same materialize-before-limit hazard as the main sweep — refuse, don't hang
      let res: CheckResult
      try { res = await fn(ph, needsRank ? 0 : null) } catch { continue }
      if (res.status === 'fail') return { n: n2, addr: row.addr, r: needsRank ? 0 : null }
    }
  }
  return null
}

async function shrink(collId: string, gradeCount: number, fn: CheckFn, pointHandle: string, r: number | null, n: number | null, caps: Caps): Promise<string> {
  const needsRank = r != null
  let bestR = r
  if (needsRank) bestR = await shrinkRankOnly(pointHandle, fn, r!)
  const fiberShrunk = await shrinkFiber(collId, gradeCount, fn, n, needsRank, caps)
  if (fiberShrunk) return `n=${fiberShrunk.n} addr=${fiberShrunk.addr}${fiberShrunk.r != null ? ` r=${fiberShrunk.r}` : ''}`
  return `n=${n ?? '(ungraded)'}${bestR != null ? ` r=${bestR}` : ''}`
}

// ---- main sweep ----

type Mismatch = { coll: string; property: string; n: number | null; addr: string; r: string; detail: string; shrunk: string }
type Skip = { coll: string; property: string; reason: string }
const mismatches: Mismatch[] = []
const skips: Skip[] = []
let pointsSampled = 0, propChecks = 0, propPass = 0

const cats = await q<{ id: string; carrier: string; grades: string; alias_of: string | null }>(
  `SELECT id, carrier, grades::text AS grades, alias_of FROM base_catalog ORDER BY id`)

let collsConsidered = 0
for (const c of cats) {
  if (filter && !c.id.includes(filter)) continue
  if (c.alias_of) { skips.push({ coll: c.id, property: '*', reason: 'alias — no realized surface' }); continue }
  collsConsidered++
  const gradeCount = (c.grades.replace(/^\{|\}$/g, '').match(/[^,]+/g) ?? []).length

  const caps: Caps = {
    hasCount: await regproc(`fiber_count(${c.id}_fiber)`),
    hasUnrank: await regproc(`fiber_unrank(${c.id}_fiber, rank_index)`),
    hasContains: await regproc(`contains(${c.id}, ${c.carrier})`),
  }
  process.stderr.write(`  · ${c.id}${caps.hasCount ? ' [count]' : ''}${caps.hasUnrank ? ' [unrank]' : ''}${caps.hasContains ? ' [contains]' : ''}\n`)

  // usesGenericUnrank: properties that call the universal unrank(handle, r) — safe when the collection has a direct
  // fiber_unrank accel, or gated by isScanSafe (see above) when it falls back to the naive floor scan. 'count' has
  // its own CAP_COUNT guard inline; 'accel==naive' always touches the naive side (element_at IS the thing under
  // test), so it needs isScanSafe regardless of hasUnrank.
  const props: [string, CheckFn, boolean][] = [
    ['round-trip', mkCheckRoundTrip(), true],
    ['accel==naive', mkCheckAccelNaive(caps), true],
    ['count', mkCheckCount(caps), false],
    ['membership', mkCheckMembership(caps), true],
    ['order', mkCheckOrder(), true],
  ]

  const collT0 = Date.now()
  for (let i = 0; i < POINTS; i++) {
    try {
      const n = gradeCount === 0 ? null : randInt(NMAX + 1)
      const sizeHandle = gradeCount === 0 ? `${c.id}()` : `${c.id}(${n})`
      const addrRows = await q<{ addr: string }>(`SELECT fiber_address(f)::text AS addr FROM fibers(${sizeHandle}) f ORDER BY fiber_address(f)`)
      if (!addrRows.length) { skips.push({ coll: c.id, property: '*', reason: `no fibers at n=${n}` }); continue }
      const addrText = addrRows[randInt(addrRows.length)].addr
      const vals = parseAddr(addrText)
      const pointHandle = vals.length ? `${c.id}(${vals.join(',')})` : `${c.id}()`

      const cardRow = (await q<{ card: string | null }>(`SELECT cardinality(${pointHandle})::text AS card`))[0]
      const cardNum = cardRow?.card == null || cardRow.card === 'infinity' ? Infinity : Number(cardRow.card)
      const rankCap = caps.hasUnrank ? RANK_CAP : SCAN_RANK_CAP
      const effCap = Math.min(Number.isFinite(cardNum) ? cardNum : rankCap, rankCap)
      const r = effCap > 0 ? randInt(effCap) : null
      pointsSampled++
      // reuse the cardinality we already fetched above — no extra query (see isScanSafe's doc comment for why)
      const scanSafe = caps.hasUnrank || !Number.isFinite(cardNum) || cardNum <= RANK_CAP

      for (const [name, fn, needsScanGuard] of props) {
        propChecks++
        if (needsScanGuard) {
          if (!scanSafe) {
            skips.push({ coll: c.id, property: name, reason: `no unrank accel and fiber too large to scan safely (cardinality≈${cardNum})` })
            continue
          }
        }
        const res = await fn(pointHandle, name === 'count' ? null : r)
        if (res.status === 'fail') {
          const shrunk = await shrink(c.id, gradeCount, fn, pointHandle, name === 'count' ? null : r, n, caps)
          mismatches.push({ coll: c.id, property: name, n, addr: addrText, r: r == null ? '(none)' : String(r), detail: res.detail ?? '', shrunk })
        } else if (res.status === 'skip') {
          skips.push({ coll: c.id, property: name, reason: res.detail ?? 'skipped' })
        } else {
          propPass++
        }
      }
    } catch (e: any) {
      skips.push({ coll: c.id, property: '*', reason: errMsg(e) })
    }
  }
  const collMs = Date.now() - collT0
  if (collMs > 300) process.stderr.write(`      ⏱ ${c.id} took ${collMs}ms\n`)
}

console.log(`\nproperty-based verification (QuickCheck-style sampling)\n`)
console.log(`collections considered: ${collsConsidered} (of ${cats.length} in catalog)`)
console.log(`points sampled: ${pointsSampled}`)
console.log(`property checks: ${propChecks}  (pass ${propPass}, fail ${mismatches.length}, skip ${skips.length})`)
if (skips.length) {
  const byReason = new Map<string, number>()
  for (const s of skips) byReason.set(s.reason, (byReason.get(s.reason) ?? 0) + 1)
  console.log(`\nskipped (${skips.length}), by reason:`)
  for (const [reason, n] of [...byReason.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${n.toString().padStart(4)}  ${reason}`)
}
if (mismatches.length) {
  console.log(`\n✗ MISMATCHES (${mismatches.length}) — seed=${seed}, replay with: node --import tsx quickcheck.mts <coll> ${seed}\n`)
  for (const m of mismatches) {
    console.log(`  [${m.property}] ${m.coll}  n=${m.n ?? '(ungraded)'} addr=${m.addr} r=${m.r}`)
    console.log(`      ${m.detail}`)
    console.log(`      shrunk: ${m.shrunk}`)
  }
} else {
  console.log(`\n✓ no mismatches — every sampled point (seed=${seed}) agrees.`)
}

await pg.close()
process.exit(mismatches.length ? 1 : 0)
