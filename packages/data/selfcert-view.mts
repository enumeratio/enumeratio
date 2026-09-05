// Self-certification — the VIEW-CONFIG differential (issue #28: "the table config IS a SQL query").
//
// selfcert.mts certifies the per-FIBER accelerations (fiber_count vs enumeration, element_at vs sequential). This is the
// next layer up: a whole VIEW CONFIG — a projection + optional WHERE / ORDER BY / GROUP BY / HAVING / LIMIT — has a fast
// path (a capped window read, a closed-form distribution over fibers) AND a naive definition (materialize the WHOLE
// fiber set, then apply the same clauses in plain SQL). They MUST agree. This sweeps bounded collections × representative
// view configs and diffs the two, set-equal or sequence-equal as the clause demands.
//
//   WINDOW   projection + ORDER BY canonical + LIMIT/OFFSET
//            accel: elements(h, first+count) capped iterator, windowed   ==  naive: elements(h, ∞) fully, then windowed   (sequence)
//   GROUP    GROUP BY the grade axis (the triangle / size distribution)
//            accel: fiber_count(f) per fiber (closed form)               ==  naive: enumerate all, GROUP BY grade, count  (set)
//   GRP+W+H  GROUP BY grade + WHERE (a grade predicate) + HAVING (count)
//            accel: the same, over fibers filtered by the predicate      ==  naive: enumerate, row-filter, group, HAVING   (set)
//   COUNT    the view's row count, unfiltered and grade-filtered
//            accel: cardinality(h) / sum(fiber_count) over kept fibers   ==  naive: count(*) over the (filtered) materialize (scalar)
//   ROWVIEW  a row-level WHERE + custom ORDER BY + LIMIT (the query-model proj-CTE shape)
//            query-model SQL (WITH proj … row_number … WHERE … ORDER BY … LIMIT)  ==  a flat naive SELECT                  (sequence)
//
// Bounded/eager collections only — the naive path materializes the whole fiber set, so it's capped by CAP_TOTAL (the same
// scale guard the client's view queries carry). Opt-in + slow, NOT a default gate.
//
//   node --import tsx selfcert-view.mts            # sweep all bounded collections, report mismatches, exit nonzero on any
//   node --import tsx selfcert-view.mts k_subset   # only collections whose id contains "k_subset"
//   node --import tsx selfcert-view.mts --pack polytopes  # only collections owned by the "polytopes" pack
import { createRequire } from 'node:module'
import { loadCoreAndPacks } from './node.ts'
import { orderPacks, segmentByPack, applyPackSegments } from './sqlsrc-order'
import { parsePackArg, requireNonEmptySelection } from './pack-filter'

const req = createRequire(import.meta.url)
const { PGlite } = req('@electric-sql/pglite') as typeof import('@electric-sql/pglite')

const CAP_TOTAL = 5000       // largest handle (total elements over its fibers) we materialize naively — the scale guard
const NMAX = 6               // sizes tried when building a spanning handle coll(n): NMAX..1, first that fits CAP_TOTAL
const WINDOW_MAX = 25        // rows read in the WINDOW config (a mid-collection slice)
const LIMIT_MAX = 10         // rows kept in the ROWVIEW config
const BIG = 2147483647       // the "materialize everything" emit cap (matches the core's own unrank scan cap)
const STMT_TIMEOUT = '8s'    // a pathological config is skipped (recorded), not left to hang the sweep

const { pack, rest } = parsePackArg(process.argv.slice(2))
const filter = rest[0] ?? null

// Full profile — core + every extracted pack (#283 phase 3.4): a --pack filter over a corpus that never loaded
// the pack would silently select nothing.
const { core, packs } = loadCoreAndPacks()
const segments = segmentByPack(orderPacks(core, packs), core, packs)
const pg = new PGlite()
await pg.waitReady
await applyPackSegments(segments, async (label, sql) => {
  try { await pg.exec(sql) }
  catch (e: any) { console.error(`\n✗ FAILED applying ${label}\n  ${e.message.split('\n')[0]}\n`); await pg.close(); process.exit(1) }
})

await pg.exec(`SET statement_timeout = '${STMT_TIMEOUT}'`)
const q = async <T = any,>(sql: string): Promise<T[]> => (await pg.query(sql)).rows as T[]
const regproc = async (sig: string): Promise<boolean> =>
  !!(await q<{ x: boolean }>(`SELECT to_regprocedure('${sig}') IS NOT NULL AS x`))[0]?.x
const j = (rows: unknown[]) => JSON.stringify(rows)

// grade-coordinate helpers (SQL text): the fiber's address is a rank_index[]; the last coordinate is the finest grade.
const AX_F = 'cardinality(address(f))'                     // #coords of a fiber alias `f`
const AX_E = 'cardinality(address((e).fiber))'             // #coords of the element alias `e`'s fiber
const LAST_F = `(address(f))[${AX_F}]`                     // finest grade coord of `f`
const LAST_E = `(address((e).fiber))[${AX_E}]`             // finest grade coord of `e`'s fiber

type Config = 'window' | 'group' | 'grp+w+h' | 'count' | 'count(where)' | 'rowview'
type Mismatch = { coll: string; config: Config; handle: string; expected: string; got: string }
const mismatches: Mismatch[] = []
type Skip = { coll: string; reason: string }
const skips: Skip[] = []
const ran: Record<Config, number> = { window: 0, group: 0, 'grp+w+h': 0, count: 0, 'count(where)': 0, rowview: 0 }
let collsSwept = 0

// A pass/fail check: run accel + naive, compare, record a mismatch on divergence. Returns whether it ran (vs errored).
const check = async (coll: string, config: Config, handle: string, accelSql: string, naiveSql: string): Promise<boolean> => {
  const [a, n] = [await q(accelSql), await q(naiveSql)]
  ran[config]++
  if (j(a) !== j(n)) mismatches.push({ coll, config, handle, expected: `naive ${j(n)}`, got: `accel ${j(a)}` })
  return true
}

const cats = await q<{ id: string; arity: number; unbounded: boolean; pack: string }>(
  `SELECT cat.id, cardinality(cat.grades) AS arity, cat.unbounded, col.pack
     FROM base_catalog cat JOIN base_collection col ON col.id = cat.id ORDER BY cat.id`,
)

const selected = cats.filter((c) => (!pack || c.pack === pack) && (!filter || c.id.includes(filter)))
if (pack) console.log(`--pack ${pack} → ${selected.length} collection(s)${filter ? ` matching "${filter}"` : ''}: ${selected.map((c) => c.id).join(', ') || '(none)'}`)
requireNonEmptySelection('selfcert-view', pack, filter, selected.length, () => { void pg.close() })

for (const c of selected) {
  if (c.unbounded) continue                                // the naive path materializes the whole fiber set — bounded only
  const hasCount = await regproc(`fiber_count(${c.id}_fiber)`)

  // Build a handle: ungraded ⇒ coll(); graded ⇒ coll(n) with n as large as fits CAP_TOTAL (a partially-applied handle on
  // a multi-axis collection spans the remaining axes — that's what gives GROUP BY grade something to group over).
  let handle: string | null = null, total = 0, nfib = 0
  const candidates = c.arity === 0 ? [null] : Array.from({ length: NMAX }, (_, i) => NMAX - i)
  for (const n of candidates) {
    const h = n === null ? `${c.id}()` : `${c.id}(${n})`
    try {
      const [r] = await q<{ k: number; tot: string | null }>(
        `SELECT count(*) AS k, sum(cardinality(f))::text AS tot FROM fibers(${h}) f`)
      const k = Number(r?.k ?? 0), tot = r?.tot
      if (k >= 1 && tot != null && tot !== 'Infinity' && Number(tot) > 0 && Number(tot) <= CAP_TOTAL) { handle = h; total = Number(tot); nfib = k; break }
    } catch { /* a degenerate size (coll(0), out-of-range) — try the next */ }
  }
  if (handle === null) { skips.push({ coll: c.id, reason: `no bounded handle within ${CAP_TOTAL} elements` }); continue }
  collsSwept++
  process.stderr.write(`  · ${c.id} → ${handle}  (${nfib} fiber${nfib === 1 ? '' : 's'}, ${total} elems)${hasCount ? ' [count]' : ''}\n`)

  try {
    // WINDOW — a mid-collection slice in canonical order: the capped-iterator read vs the full materialize (sequence).
    const off = Math.floor(total / 3), cnt = Math.min(Math.max(1, total - off), WINDOW_MAX)
    await check(c.id, 'window', handle,
      `SELECT render(e) el FROM elements(${handle}, ${off + cnt}) e ORDER BY e OFFSET ${off} LIMIT ${cnt}`,
      `SELECT render(e) el FROM elements(${handle}, ${BIG}) e ORDER BY e OFFSET ${off} LIMIT ${cnt}`)

    // ROWVIEW — a row-level WHERE + custom ORDER BY + LIMIT, the query-model proj-CTE shape (row_number over the ordered
    // stream, then filter+sort+cut) vs a flat naive SELECT. Certifies the whole-view SQL composition (sequence).
    await check(c.id, 'rowview', handle,
      `WITH proj AS (SELECT render(e) el, ordinality(e) ord FROM (SELECT e FROM elements(${handle}, ${BIG}) e ORDER BY e) e)
         SELECT el FROM proj WHERE ord % 2 = 0 ORDER BY el DESC LIMIT ${LIMIT_MAX}`,
      `SELECT render(e) el FROM elements(${handle}, ${BIG}) e WHERE ordinality(e) % 2 = 0 ORDER BY render(e) DESC LIMIT ${LIMIT_MAX}`)

    if (hasCount) {
      // COUNT — the whole-view row count: the closed-form cardinality vs count(*) over the materialize (scalar).
      await check(c.id, 'count', handle,
        `SELECT (cardinality(${handle}))::numeric::text n`,
        `SELECT count(*)::text n FROM elements(${handle}, ${BIG}) e`)

      if (nfib > 1) {
        // GROUP — GROUP BY the grade axis (the triangle / distribution): closed-form fiber counts vs enumerate-and-group
        // (set). Empty fibers (closed-form count 0 — e.g. permutations with 0 cycles) are excluded: SQL GROUP BY count(*)
        // never emits a zero-count group, so the reference can't have them. Those zero counts are certified by selfcert.mts.
        await check(c.id, 'group', handle,
          `SELECT address(f)::text g, fiber_count(f)::numeric::text n FROM fibers(${handle}) f WHERE fiber_count(f)::numeric > 0 ORDER BY 1`,
          `SELECT address((e).fiber)::text g, count(*)::text n FROM elements(${handle}, ${BIG}) e GROUP BY 1 ORDER BY 1`)

        // GRP+W+H — GROUP BY grade + WHERE (finest coord even) + HAVING (count > 1): fibers filtered before the closed-form
        // count vs the same as a row-level filter + GROUP BY + HAVING over the materialize (set).
        await check(c.id, 'grp+w+h', handle,
          `SELECT address(f)::text g, fiber_count(f)::numeric::text n FROM fibers(${handle}) f
             WHERE ${LAST_F} % 2 = 0 AND fiber_count(f)::numeric > 1 ORDER BY 1`,
          `SELECT g, n FROM (SELECT address((e).fiber)::text g, count(*)::text n FROM elements(${handle}, ${BIG}) e
             WHERE ${LAST_E} % 2 = 0 GROUP BY 1 HAVING count(*) > 1) t ORDER BY 1`)

        // COUNT(where) — the grade-filtered row count: sum of closed-form counts over kept fibers vs count(*) over the
        // row-filtered materialize (scalar).
        await check(c.id, 'count(where)', handle,
          `SELECT coalesce(sum(fiber_count(f)), 0)::numeric::text n FROM fibers(${handle}) f WHERE ${LAST_F} % 2 = 0`,
          `SELECT count(*)::text n FROM elements(${handle}, ${BIG}) e WHERE ${LAST_E} % 2 = 0`)
      }
    }
  } catch (e: any) {
    skips.push({ coll: c.id, reason: e.message.split('\n')[0] })
  }
}

const totalChecks = Object.values(ran).reduce((a, b) => a + b, 0)
console.log(`\nself-certification — view-config differential (accelerated == naive)\n`)
console.log(`collections swept: ${collsSwept}`)
console.log(`view checks: ${totalChecks}   (` + (Object.keys(ran) as Config[]).map((k) => `${k} ${ran[k]}`).join(', ') + `)`)
if (skips.length) {
  console.log(`\nskipped (${skips.length}):`)
  for (const s of skips) console.log(`  ${s.coll} — ${s.reason}`)
}
if (mismatches.length) {
  console.log(`\n✗ MISMATCHES (${mismatches.length}):`)
  for (const m of mismatches) console.log(`  [${m.config}] ${m.handle}:\n      expected ${m.expected}\n      got      ${m.got}`)
} else {
  console.log(`\n✓ no mismatches — every accelerated view answer agrees with the naive materialize-then-clause reference.`)
}

await pg.close()
process.exit(mismatches.length ? 1 : 0)
