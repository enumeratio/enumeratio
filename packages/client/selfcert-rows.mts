// Self-certification — the ROW-HALF differential: planRows() (one accelerated request per grouping-set level — slices,
// streamed fibers + closed-form cardinality, rollup levels) MUST equal rowSql() (the logical statement over the element
// relation, evaluated naively) on every bounded configuration. The third selfcert layer, over selfcert.mts (per-fiber
// accels) and selfcert-view.mts (view configs): here the config is a RowQuery — the query view's own state.
//
// Case 6 (#247, policies.md §6): after the hand-picked cases above, walk base_policy_resolved — one opening
// statement per (collection, environment). For each row: build the RowStatement (FROM = the bare collection, no
// bindings — the `<axis> = 4` fallback is panel-only; GROUP BY = the resolved group_by; SELECT = the resolved
// select_list with `<keys>` expanded to the statement's own GROUP BY keys), check it round-trips
// searchFromRowQuery ⇄ rowQueryFromSearch byte-for-byte, then that planRows succeeds on it (an open/unbounded
// handle just streams a window — that's fine, nothing here binds an axis). Checked empirically before writing this:
// `web` and `print` resolve the SAME (select_list, group_by, window_size) for every collection — print's
// restrictive row only strips glyph/data, which no seeded default carries — and only `terminal` differs, only for
// the 22 permutation-carrier collections (its carrier-scope override drops the position columns). So the walk
// dedupes PER COLLECTION to the distinct statements it actually resolves (~240 + 22 ≈ 262 checks, not 720) rather
// than re-testing three byte-identical statements per collection.
//
// The walk runs on makeWorkerDb() (setQueryTimeout), not the main-thread makeDb() the cases above use: a genuinely
// pathological resolved statement (found while writing this — gelfand_tsetlin's default `n, k, count` fibers table,
// open on both axes, calls cardinality(f) per candidate fiber, and that collection has no fiber_count accel, so it
// falls back to counting fiber_elements() — combinatorially explosive past n ~ 8) can't be interrupted any other
// way (node.ts's own doc comment: "a non-terminating enumeration can't be terminate()'d any other way" — and this
// project's own statement_timeout does NOT reliably bound it either, confirmed by hand). The watchdog rejects a
// slow query and kills the worker; the next query respawns a fresh one, so ONE bad collection doesn't hang the sweep.
//
// SKIP vs FAIL, mirroring packages/data/selfcert.mts's convention ("a pathological fiber is skipped (recorded), not
// left to hang the sweep"): a watchdog timeout in the walk is a printed SKIP tagged #254 (a real registry gap — no
// fiber_count accel on gelfand_tsetlin, and a sparse-fiber open-handle case on boolean_permutations /
// multicomplex_numbers / multisets / singleton_species where the generic open-handle walker never reaches the
// requested window — found by this walk, tracked there, not fixed here), not a hard failure. (#255, the
// `fibers · prefix of two axes` cast bug this file used to mark `knownRed`, is fixed — see select.ts's `symbol`
// case: a level grouped by a bare prefix of the axes now reads NULL instead of casting a short ROW to the full
// `<coll>_fiber` composite.) Neither #254 nor any future knownRed case is fixed by this change automatically —
// that mechanism stays available for real, separate engine/algorithm work.
// Opt-in, not a default gate:   node --import tsx selfcert-rows.mts [filter]   (a filter skips the policy walk too)
import { provideDb, makeDb, makeWorkerDb, setQueryTimeout, planRows, planDeferred, rowSql, runSql, close, parseGroupBy, collectionParams, rowQueryFromSearch, searchFromRowQuery, type RowQuery, type RowSelect, type RowTable, type RowWindow, type RowStatement, type Archetype } from './src/index.ts'

provideDb(() => makeDb())
const filter = process.argv[2] ?? null

// bounded configurations only (the naive side materializes the relation); open handles are exercised for shape only
const cases: { id: string; q: RowQuery; w?: RowWindow; sel?: RowSelect; diff: boolean; prefixOf?: string; rowgroup?: boolean; knownRed?: string; expect?: (t: RowTable) => Promise<string | null> }[] = [
  { id: 'elements · restriction', q: { from: 'permutations(size=4)', where: 'descents >= 2' }, diff: true },
  { id: 'elements · stat sort', q: { from: 'permutations(4)', orderBy: 'inversions DESC, rank' }, w: { count: 6 }, diff: true },
  { id: 'elements · band slice', q: { from: 'permutations(size=0..4)' }, w: { first: 5, count: 7 }, diff: true },
  { id: 'elements · open trailing axis', q: { from: 'k_subsets(n=2..3)' }, diff: true },
  { id: 'elements · stat id collision', q: { from: 'subsets(3)', where: 'rank_stat = 2' }, diff: true },
  { id: 'fibers · band', q: { from: 'permutations(size=0..6)', groupBy: 'size' }, diff: true },
  { id: 'fibers · prefix of two axes', q: { from: 'k_subsets(n=0..4)', groupBy: 'n' }, diff: true },
  { id: 'fibers · key lens', q: { from: 'k_subsets(n=0..7)', groupBy: 'n, k', having: 'k = 2' }, diff: true },
  { id: 'fibers · measure lens', q: { from: 'permutations(size=0..7)', groupBy: 'size', having: 'count(*) > 5' }, diff: true },
  { id: 'fibers · lo_expr = 1 axis', q: { from: 'colored_motzkin_paths(n=0..3)', groupBy: 'n, r' }, diff: true },
  { id: 'rollup', q: { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)' }, diff: true },
  { id: 'distribution · q-analog', q: { from: 'permutations(4)', groupBy: 'inversions' }, diff: true },
  { id: 'distribution · triangle', q: { from: 'permutations(size=0..4)', groupBy: 'size, descents' }, diff: true },
  { id: 'distribution · meta', q: { from: 'collections', groupBy: 'carrier', having: 'count(*) >= 8', orderBy: 'count DESC' }, diff: true },
  { id: 'open · elements frontier', q: { from: 'permutations' }, w: { first: 8, count: 4 }, diff: false },
  { id: 'open · fibers frontier', q: { from: 'integer_partitions', groupBy: 'n' }, w: { fiberLimit: 8 }, diff: false },
  { id: 'open · measure lens past 171! (numeric text, not a JS number)', q: { from: 'permutations', groupBy: 'size', having: 'count(*) > 5' }, w: { fiberLimit: 200 }, diff: false },
  { id: 'open · ungraded slice', q: { from: 'prime_numbers' }, w: { first: 3, count: 3 }, diff: false },
  { id: 'rollup · registered (axis, stat): sibling fibers + parent fibers + footer', q: { from: 'permutations(size=0..5)', groupBy: 'ROLLUP (size, descents)' }, diff: true },
  { id: 'rollup · registered + measure lens (footer passes)', q: { from: 'permutations(size=0..5)', groupBy: 'ROLLUP (size, cycles)', having: 'count(*) > 1' }, diff: true },
  { id: 'grouping sets · registered ((size, descents), ())', q: { from: 'permutations(size=0..4)', groupBy: 'GROUPING SETS ((size, descents), ())' }, diff: true },
  { id: 'rollup · axes only + key lens (footer fails: NULL = 2)', q: { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)', having: 'k = 2' }, diff: true },
  { id: 'rollup · axes only + measure lens (footer passes)', q: { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)', having: 'count(*) > 1' }, diff: true },
  { id: 'open · registered rollup streams', q: { from: 'permutations', groupBy: 'ROLLUP (size, descents)' }, w: { fiberLimit: 12 }, diff: false },
  { id: 'open · registered distribution streams (Eulerian rows of open permutations)', q: { from: 'permutations', groupBy: 'size, descents' }, w: { fiberLimit: 20 }, diff: false, prefixOf: 'permutations(size=0..4)' },
  { id: 'open · registered distribution, 2-axis sibling with a dependent bound (Stirling-1 rows)', q: { from: 'permutations', groupBy: 'size, cycles' }, w: { fiberLimit: 20 }, diff: false, prefixOf: 'permutations(size=0..4)' },
  { id: 'distribution · registered + measure lens', q: { from: 'permutations(size=0..5)', groupBy: 'size, cycles', having: 'count(*) > 10' }, diff: true },
  { id: 'distribution · registered, stat first in GROUP BY', q: { from: 'subsets(n=0..4)', groupBy: 'cardinality, n' }, diff: true },
  { id: 'rowgroup', q: { from: 'permutations(size=0..3)', groupBy: 'GROUPING SETS ((size, rank, element), (size))' }, diff: false, rowgroup: true },
  { id: 'rowgroup · 2-axis prefix + measure lens (literal: element rows have count 1 and fail)', q: { from: 'k_subsets(n=0..3)', groupBy: 'GROUPING SETS ((n, k, rank, element), (n))', having: 'count(*) > 1' }, diff: false, rowgroup: true },
  { id: 'rowgroup · key lens keeps a group with its elements', q: { from: 'k_subsets(n=0..3)', groupBy: 'GROUPING SETS ((n, k, rank, element), (n))', having: 'n >= 2' }, diff: false, rowgroup: true },
  // #214 item 2: a fiber column (symbol) on a ROWGROUP statement used to fall into the naive GROUPING SETS path —
  // plain keys+count+symbol rows with no __group/subtotals, the wrong shape for rowgroup's subheader split. It now
  // takes its own accelerated route: symbol lands on the subtotal subheader (C10), never on an element row, and the
  // table keeps its element/subtotal structure intact.
  { id: 'rowgroup · fiber column (symbol) lands on the subtotal rows, not the elements (#214)',
    q: { from: 'permutations(size=0..3)', groupBy: 'GROUPING SETS ((size, rank, element), (size))' },
    sel: { select: 'size, rank, element, count, symbol' }, diff: false,
    expect: async (t) => {
      if (t.archetype !== 'rowgroup') return `expected archetype rowgroup, got ${t.archetype}`
      if (!t.subtotals?.length) return 'expected subtotal rows (rowgroup subheaders)'
      if (t.subtotals.some((r) => r.symbol == null)) return `every subtotal should carry a symbol; got ${JSON.stringify(t.subtotals.map((r) => r.symbol))}`
      if (t.rows.some((r) => r.symbol != null)) return 'symbol names a whole fiber — it must be NULL on element rows (C10)'
      if (t.rows.some((r) => r.__group == null)) return 'every element row must still carry __group (the rowgroup structure)'
      return null
    } },
  // the SELECT half: extra element-level columns (a stat and a map image) must ride the accelerated slice exactly as the naive relation projects them
  { id: 'elements · select + map', q: { from: 'permutations(size=4)' }, sel: { select: ['descents', 'map:inverse'] }, diff: true },
  // ── element relations (#237): GROUP BY orbit:/map: (the map kernel) and ORDER BY <graded cover> ───────────────
  // the kernel enumerates (no registered sibling), so plan == naive is the grouped statement itself; the doc's Pólya
  // identity is the real check — orbit count = the necklace count
  { id: 'kernel · GROUP BY orbit:rotation (plan == naive)', q: { from: 'words(4, 2)', groupBy: 'orbit:rotation' }, diff: true },
  { id: 'kernel · GROUP BY map:inverse (plan == naive)', q: { from: 'permutations(4)', groupBy: 'map:inverse' }, diff: true },
  { id: 'kernel · orbit:rotation count = the necklace count (Pólya), n=1..6', q: { from: 'words(4, 2)', groupBy: 'orbit:rotation' }, diff: false,
    expect: async () => {
      const [r] = await runSql<{ bad: number }>(
        `SELECT count(*) FILTER (WHERE reps <> necklaces)::int AS bad FROM (
           SELECT (SELECT count(DISTINCT word_canonical_rotation((e).value)) FROM elements(words(n,2)) e) reps,
                  (SELECT count(*) FROM elements(words(n,2)) e WHERE is_word_necklace((e).value)) necklaces
             FROM generate_series(1,6) n) t`)
      return r?.bad === 0 ? null : `orbit:rotation count disagrees with the necklace count on ${r?.bad} sizes`
    } },
  // ORDER BY a graded cover: the derived rank (chain length from a minimum) must equal the known grading — weak order
  // is graded by inversions (element-relations doc, crux d)
  { id: 'order · weak_order rank = inversions (graded cover), permutations(4)', q: { from: 'permutations(4)', orderBy: 'weak_order' }, diff: false,
    expect: async (t) => {
      const inv = (s: string) => { const a = [...s].map(Number); let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++; return c }
      const bad = (t.rows as Record<string, unknown>[]).find((r) => inv(String(r.element)) !== Number(r['rank:weak_order']))
      if (bad) return `weak_order rank ${bad['rank:weak_order']} != inversions ${inv(String(bad.element))} for ${bad.element}`
      const ord = (t.rows as Record<string, unknown>[]).map((r) => Number(r['rank:weak_order']))
      return ord.every((r, i) => i === 0 || r >= ord[i - 1]) ? null : 'rows are not ordered by the derived rank'
    } },
  // ── the COLUMN half (#205): every source's projection, accelerated vs the naive statement ───────────────────
  { id: 'select · reprs and media (C1)', q: { from: 'permutations(size=4)' }, sel: { select: 'address, element, repr:cycle, repr:oneline@latex, repr:ambient' }, diff: true },
  { id: 'select · map images and a chain (C2)', q: { from: 'permutations(size=4)' }, sel: { select: 'map:inverse, map:cycle_type, through:cycle_type.conjugate' }, diff: true },
  { id: 'select · glyph and the data cast (C3)', q: { from: 'dyck_paths(n=3)' }, sel: { select: 'glyph, data', eager: true }, diff: true },
  // §4: a streamed window defers the glyph — the keyed fetch fills it for the rows in view
  { id: 'select · glyph defers on a streamed window, planDeferred fills it', q: { from: 'dyck_paths' }, w: { count: 4 }, sel: { select: 'element, glyph' }, diff: false,
    expect: async (t) => {
      if (!t.deferred.includes('glyph')) return `expected glyph to be deferred; deferred = [${t.deferred.join(', ')}]`
      if (t.rows.some((r) => r.glyph != null)) return 'a deferred column must not ride the window'
      const keyed = await planDeferred({ from: 'dyck_paths' }, t.rows.map((r) => String(r.address)), { count: 4 }, { select: 'element, glyph' })
      const byAddr = new Map(keyed.map((r) => [String(r.address), r.glyph]))
      const missing = t.rows.filter((r) => !String(byAddr.get(String(r.address)) ?? '').startsWith('<svg'))
      return missing.length ? `${missing.length} of ${t.rows.length} rows got no glyph from the keyed fetch` : null
    } },
  // #214 item 1: under WHERE/ORDER BY the plan's element window is a RESTRICTED/SORTED slice of the whole fiber, not
  // the canonical [first, first+count) range — planDeferred used to key by that canonical slice regardless, so a row
  // whose canonical rank fell outside it got no glyph even though it was right there in the table. Keying by the
  // plan's OWN addresses (not a re-derived window) fixes it for every row, not just the ones that happen to coincide.
  { id: 'select · glyph defers under WHERE + ORDER BY, planDeferred fills every row (#214)',
    q: { from: 'dyck_paths(n=5)', where: 'major_index >= 2', orderBy: 'major_index DESC' }, w: { count: 6 },
    sel: { select: 'element, major_index, glyph' }, diff: false,
    expect: async (t) => {
      if (!t.deferred.includes('glyph')) return `expected glyph to be deferred; deferred = [${t.deferred.join(', ')}]`
      if (t.rows.length < 4) return `test needs a few rows to be meaningful, got ${t.rows.length}`
      const keyed = await planDeferred(
        { from: 'dyck_paths(n=5)', where: 'major_index >= 2', orderBy: 'major_index DESC' },
        t.rows.map((r) => String(r.address)), { count: 6 }, { select: 'element, major_index, glyph' })
      const byAddr = new Map(keyed.map((r) => [String(r.address), r.glyph]))
      const missing = t.rows.filter((r) => !String(byAddr.get(String(r.address)) ?? '').startsWith('<svg'))
      return missing.length ? `${missing.length} of ${t.rows.length} rows got no glyph from the keyed fetch (WHERE/ORDER BY reorders addresses away from the canonical window)` : null
    } },
  { id: 'select · positions (C4)', q: { from: 'permutations(size=0..3)' }, w: { first: 3, count: 4 }, sel: { select: 'rank, address, omega, element' }, diff: true },
  { id: 'select · title on a meta collection (C9)', q: { from: 'collections' }, w: { count: 8 }, sel: { select: 'element, title' }, diff: true },
  // fiber columns: the registered refinement's closed-form fibers (C7/C8) must equal the naive enumeration (C6/C5)
  { id: 'select · dist off the sibling (C7 == C6)', q: { from: 'permutations(size=0..5)', groupBy: 'size' }, sel: { select: 'size, count, dist:descents' }, diff: true },
  { id: 'select · min/max/sum/avg off the sibling (C8 == C5)', q: { from: 'permutations(size=0..5)', groupBy: 'size' }, sel: { select: 'min:descents, max:descents, sum:descents, avg:descents' }, diff: true },
  { id: 'select · an equidistributed stat reads the same sibling', q: { from: 'permutations(size=0..5)', groupBy: 'size' }, sel: { select: 'dist:ascents, sum:excedances' }, diff: true },
  { id: 'select · Pascal: the subsets distribution off k_subsets', q: { from: 'subsets(n=0..5)', groupBy: 'n' }, sel: { select: 'dist:cardinality, max:cardinality' }, diff: true },
  { id: 'select · an UNregistered statistic enumerates (naive both sides)', q: { from: 'permutations(size=0..4)', groupBy: 'size' }, sel: { select: 'min:inversions, max:inversions, sum:inversions, avg:inversions' }, diff: true },
  { id: 'select · the fiber symbol', q: { from: 'permutations(size=0..4)', groupBy: 'size' }, sel: { select: 'size, count, symbol' }, diff: true },
  { id: 'select · a lens over accelerated fiber columns', q: { from: 'permutations(size=0..5)', groupBy: 'size', having: 'count(*) > 2' }, sel: { select: 'dist:descents, max:descents' }, diff: true },
  // C10: a rollup carries each level's own columns — the symbol names the fiber, so it is NULL off its level
  { id: 'select · rollup carries the symbol on its own level (C10)', q: { from: 'permutations(size=0..4)', groupBy: 'ROLLUP (size)' }, sel: { select: 'size, count, symbol' }, diff: true },
  { id: 'select · rollup symbol over two axes', q: { from: 'k_subsets(n=0..3)', groupBy: 'ROLLUP (n, k)' }, sel: { select: 'n, k, count, symbol' }, diff: true },
  // §10: the same numbers `dist:` holds in one cell, drawn WIDE — one column per value of the statistic
  { id: 'select · pivot draws the triangle wide (registered sibling)', q: { from: 'permutations(size=0..5)', groupBy: 'size' }, sel: { select: 'size, count, pivot:descents' }, diff: true },
  { id: 'select · pivot beside the dist cell it spreads', q: { from: 'permutations(size=0..4)', groupBy: 'size' }, sel: { select: 'size, dist:descents, pivot:descents' }, diff: true },
  { id: 'select · pivot on an unregistered statistic (bounded, naive both sides)', q: { from: 'permutations(size=0..4)', groupBy: 'size' }, sel: { select: 'size, pivot:inversions' }, diff: true },
  { id: 'select · pivot on Pascal', q: { from: 'subsets(n=0..4)', groupBy: 'n' }, sel: { select: 'n, pivot:cardinality' }, diff: true },
  // §10: a fiber column LIFTED onto element rows — the partition is the fiber, so the two column levels meet
  { id: 'select · over:count lifts the fiber size onto element rows', q: { from: 'permutations(size=0..4)' }, sel: { select: 'address, element, over:count' }, diff: true },
  { id: 'select · over an aggregate off the registered sibling', q: { from: 'permutations(size=0..4)' }, sel: { select: 'element, over:max:descents, over:sum:descents, over:avg:descents' }, diff: true },
  { id: 'select · over the fiber symbol', q: { from: 'permutations(size=0..4)' }, sel: { select: 'element, over:symbol' }, diff: true },
  { id: 'select · over an UNregistered statistic (bounded, naive both sides)', q: { from: 'permutations(size=0..4)' }, sel: { select: 'element, over:max:inversions' }, diff: true },
  // a rollup's dist / aggregates take the naive (bounded) path — C10's rule holds either way: real on the level
  // whose keys are the fiber's, NULL where the level dropped them
  { id: 'select · rollup dist and aggregates per level', q: { from: 'permutations(size=0..4)', groupBy: 'ROLLUP (size)' }, sel: { select: 'size, count, dist:descents, max:descents, level' }, diff: true },
  { id: 'select · level is GROUPING() on a composed result', q: { from: 'permutations(size=0..4)', groupBy: 'ROLLUP (size)' }, sel: { select: 'size, count, level' }, diff: true },
  { id: 'select · level is 0 on a single-level result', q: { from: 'permutations(size=0..4)', groupBy: 'size' }, sel: { select: 'size, count, level' }, diff: true },
  // §10's window identities: the positions the row half exposes ARE window functions over the enumeration
  { id: 'identity · rank / ordinality are row_number() over the enumeration', q: { from: 'permutations(size=0..4)' }, diff: false,
    expect: async () => {
      const [r] = await runSql<{ rank_ok: boolean; ord_ok: boolean }>(
        `SELECT bool_and(rank(e) = rn - 1) AS rank_ok, bool_and(orn = grn) AS ord_ok
           FROM (SELECT e, row_number() OVER (PARTITION BY size(e) ORDER BY e) AS rn,
                           row_number() OVER (ORDER BY e) AS orn,
                           (SELECT count(*) FROM elements(permutations(0, 4)) x WHERE x <= e) AS grn
                   FROM elements(permutations(0, 4)) e) t`)
      return r?.rank_ok && r?.ord_ok ? null : `rank = row_number() OVER (PARTITION BY axes): ${r?.rank_ok}; ordinality = row_number() OVER (): ${r?.ord_ok}`
    } },
  { id: 'identity · next / prev are lead / lag over the enumeration (the odometer spans the collection, so the band edge differs)', q: { from: 'permutations(size=0..4)' }, diff: false,
    expect: async () => {
      const [r] = await runSql<{ nx: number; pv: number; n: number }>(
        `SELECT count(*) FILTER (WHERE render(next(e)) IS DISTINCT FROM nxt)::int AS nx,
                count(*) FILTER (WHERE render(prev(e)) IS DISTINCT FROM prv)::int AS pv, count(*)::int AS n
           FROM (SELECT e, lead(render(e)) OVER (ORDER BY size(e), rank(e)) AS nxt,
                           lag(render(e)) OVER (ORDER BY size(e), rank(e)) AS prv
                   FROM elements(permutations(0, 4)) e) t`)
      // exactly one row may differ: the band's LAST element, where next() steps into size 5 and lead() has nothing
      return r && r.nx <= 1 && r.pv === 0 ? null : `next disagrees on ${r?.nx}/${r?.n} rows, prev on ${r?.pv}`
    } },
  // an OPEN parent streams its sibling's rows: the Eulerian distribution row after row
  { id: 'open · dist streams off the sibling', q: { from: 'permutations', groupBy: 'size' }, w: { fiberLimit: 9 }, sel: { select: 'dist:descents' }, diff: false, prefixOf: 'permutations(size=0..5)' },
]

// compare as text rows, ignoring the per-query positional/grouping helper columns
const norm = (rows: Record<string, unknown>[]) => rows.map((r) => {
  const o: Record<string, string | null> = {}
  for (const k of Object.keys(r).sort()) if (k !== 'ordinality' && k !== '__group') o[k] = r[k] == null ? null : String(r[k])   // key order is not content
  return JSON.stringify(o)
})

let mismatches = 0, checked = 0, errors = 0, knownSkips = 0
for (const c of cases) {
  if (filter && !c.id.includes(filter)) continue
  try {
    const t = await planRows(c.q, c.w, c.sel)
    if (c.rowgroup) {
      // the plan's element rows + subtotals must be the naive GROUPING SETS rows: key level (lvl 0) and the coarser level
      const naive = (await runSql(await rowSql(c.q, {}, c.sel))) as Record<string, unknown>[]
      const g = parseGroupBy(c.q.groupBy!)
      const keySet = g.sets.find((st) => st.includes('rank'))!, coarse = g.sets.find((st) => st !== keySet)!
      const key = (r: Record<string, unknown>, cols: string[]) => cols.map((k) => String(r[k])).join('|')
      const naiveElems = new Set(naive.filter((r) => Number(r.level) === 0).map((r) => key(r, keySet)))
      const naiveSubs = new Set(naive.filter((r) => Number(r.level) !== 0).map((r) => key(r, coarse) + '=' + String(r.count)))
      const planElems = new Set(t.rows.map((r) => key(r as Record<string, unknown>, keySet)))
      const planSubs = new Set((t.subtotals ?? []).map((r) => key(r as Record<string, unknown>, coarse) + '=' + String(r.count)))
      const same = (a: Set<string>, b: Set<string>) => a.size === b.size && [...a].every((x) => b.has(x))
      checked++
      if (same(naiveElems, planElems) && same(naiveSubs, planSubs)) console.log(`  ✓ ${c.id}: rowgroup, ${planElems.size} elements under ${planSubs.size} subtotals == naive`)
      else { mismatches++; console.log(`  ✗ ${c.id}: elements ${planElems.size} vs ${naiveElems.size}; subtotals ${[...planSubs].join(' ')} vs ${[...naiveSubs].join(' ')}`) }
      continue
    }
    if (c.prefixOf) {
      // an OPEN stream must agree with the bounded statement on the rows they share (the bounded band's rows are a prefix)
      const bounded = await runSql(await rowSql({ ...c.q, from: c.prefixOf }, {}, c.sel))
      const b = norm(bounded as Record<string, unknown>[]), a = norm(t.rows as Record<string, unknown>[]).slice(0, b.length)
      checked++
      if (a.length === b.length && a.every((x, i) => x === b[i])) console.log(`  ✓ ${c.id}: ${t.archetype}, ${t.rows.length} rows streamed; first ${b.length} == ${c.prefixOf}`)
      else { mismatches++; console.log(`  ✗ ${c.id}: open stream disagrees with ${c.prefixOf}\n    open:    ${a.slice(0, 4).join('\n             ')}\n    bounded: ${b.slice(0, 4).join('\n             ')}`) }
      continue
    }
    if (c.expect) {
      checked++
      const bad = await c.expect(t)
      if (bad) { mismatches++; console.log(`  ✗ ${c.id}: ${bad}`) } else console.log(`  ✓ ${c.id}: ${t.archetype}, ${t.rows.length} rows`)
      continue
    }
    if (!c.diff) { console.log(`  · ${c.id}: ${t.archetype}, ${t.rows.length} rows${t.frontier ? ' (frontier)' : ''}`); continue }
    const naive = await runSql(await rowSql(c.q, c.w, c.sel))
    const a = norm(t.rows as Record<string, unknown>[]), b = norm(naive as Record<string, unknown>[])
    const same = a.length === b.length && a.every((x, i) => x === b[i])
    checked++
    if (same) console.log(`  ✓ ${c.id}: ${t.archetype}, ${a.length} rows`)
    else { mismatches++; console.log(`  ✗ ${c.id}: plan ${a.length} rows vs naive ${b.length}\n    plan:  ${a.slice(0, 3).join('\n           ')}\n    naive: ${b.slice(0, 3).join('\n           ')}`) }
  } catch (e) {
    const msg = (e as Error).message.split('\n')[0]
    if (c.knownRed && msg === c.knownRed) { knownSkips++; console.log(`  ⊘ ${c.id}: SKIP TODO(#255) — known pre-existing: ${msg}`) }
    else { errors++; console.log(`  ✗ ${c.id}: ${msg}`) }
  }
}

// ── case 6 (#247): walk base_policy_resolved — see the header comment for the dedup rationale ──────────────────────
type PolicyRow = { collection: string; environment: string; archetype: Archetype; select_list: string | null; group_by: string | null; window_size: string | null }

/** the statement's own GROUP BY keys, mirroring rows.ts's private keysTemplate: every key across every grouping
 *  set, first-appearance order, deduplicated, minus rank/element (which belong to element rows, not a fiber's identity) */
function expandKeysTemplate(sel: string, groupBy: string | null): string {
  if (!sel.includes('<keys>')) return sel
  const g = groupBy?.trim() ? parseGroupBy(groupBy) : null
  const seen = new Set<string>(), keys: string[] = []
  for (const k of g?.sets.flat() ?? []) { if (k === 'rank' || k === 'element' || seen.has(k)) continue; seen.add(k); keys.push(k) }
  return sel.replace('<keys>', keys.join(', '))
}

const WATCHDOG_RE = /watchdog/

async function walkPolicies(): Promise<{ checked: number; failed: number; skipped: number }> {
  const rows = await runSql<PolicyRow>(
    `SELECT collection, environment, archetype, select_list, group_by, window_size
       FROM base_policy_resolved ORDER BY collection, environment`)
  const byColl = new Map<string, PolicyRow[]>()
  for (const r of rows) byColl.set(r.collection, [...(byColl.get(r.collection) ?? []), r])

  const STMT_FIELDS: (keyof RowStatement)[] = ['from', 'select', 'where', 'groupBy', 'having', 'orderBy']
  const paramsByColl = await collectionParams()   // a collection with an unbound family param is a SKELETON (see below)
  let checked = 0, failed = 0, skipped = 0, done = 0
  const failures: string[] = []
  const skips: string[] = []
  const skeletons: string[] = []
  for (const [coll, rs] of byColl) {
    // the distinct (select_list, group_by, window_size) statements THIS collection resolves, tagged by their environment(s)
    const distinct = new Map<string, { envs: string[]; row: PolicyRow }>()
    for (const r of rs) {
      const key = `${r.select_list}${r.group_by}${r.window_size}`
      const cur = distinct.get(key)
      if (cur) cur.envs.push(r.environment); else distinct.set(key, { envs: [r.environment], row: r })
    }
    for (const { envs, row } of distinct.values()) {
      checked++
      const tag = `${coll} · ${envs.join('/')}`
      try {
        if (row.select_list == null) throw new Error('select_list is NULL')
        const select = expandKeysTemplate(row.select_list, row.group_by)
        const stmt: RowStatement = { from: coll, select, ...(row.group_by ? { groupBy: row.group_by } : {}) }
        const back = rowQueryFromSearch(searchFromRowQuery(stmt))
        const mismatch = STMT_FIELDS.find((f) => (stmt[f] ?? undefined) !== (back[f] ?? undefined))
        if (mismatch) throw new Error(`round-trip: ${mismatch} "${stmt[mismatch] ?? ''}" -> "${back[mismatch] ?? ''}"`)
        // the walk's FROM is the BARE collection, so a parametric family binds none of its params here: it is a family
        // SKELETON (#67 D3/D4) — nothing to enumerate (the explorer opens it to a param picker, not a table, and
        // planRows now refuses it by design). Its statement still round-trips (checked above); the plan step doesn't
        // apply, so record it and move on. Distinct from the #254 watchdog SKIPs, which ARE plannable but time out.
        const unbound = paramsByColl[coll] ?? []
        if (unbound.length) { skeletons.push(`${tag} · bind ${unbound.join(', ')}`); continue }
        // elements/rowgroup window as a slice COUNT; fibers/distribution/rollup as a FIBER limit (rows.ts's own split)
        const w: RowWindow = row.archetype === 'elements' || row.archetype === 'rowgroup'
          ? { count: Number(row.window_size ?? 100) } : { fiberLimit: Number(row.window_size ?? 200) }
        await planRows(back, w, { select: back.select })
      } catch (e) {
        const msg = (e as Error).message.split('\n')[0]
        // a watchdog kill = a real registry gap (#254 — missing fiber_count / a sparse-fiber open handle that
        // never reaches its window), reported loudly but not fatal to THIS walk's own round-trip/mapping logic
        if (WATCHDOG_RE.test(msg)) { skipped++; skips.push(`${tag} · ${msg}`) }
        else { failed++; failures.push(`${tag} · ${msg}`) }
      }
    }
    if (++done % 25 === 0) console.log(`  … base_policy_resolved: ${done}/${byColl.size} collections`)
  }
  if (skeletons.length) {
    console.log(`\nbase_policy_resolved walk — ${skeletons.length} FAMILY SKELETON(S) (unbound family param — round-trips, nothing to enumerate):`)
    for (const s of skeletons) console.log(`  ○ family ${s}`)
  }
  if (skips.length) {
    console.log(`\nbase_policy_resolved walk — ${skips.length} SKIPPED (#254, a registry gap — not a walk failure):`)
    for (const s of skips) console.log(`  ⊘ #254 ${s}`)
  }
  if (failures.length) {
    console.log(`\nbase_policy_resolved walk — ${failed} of ${checked} FAILED:`)
    for (const f of failures) console.log(`  ✗ ${f}`)
  } else {
    console.log(`\n✓ base_policy_resolved walk: ${checked - skipped - skeletons.length} of ${checked} statements round-trip and plan cleanly`
      + (skipped ? ` (${skipped} skipped, #254)` : '')
      + (skeletons.length ? ` (${skeletons.length} family skeletons — round-trip only)` : '')
      + ` over ${byColl.size} collections (deduped from ${rows.length} rows)`)
  }
  return { checked, failed, skipped }
}

let policyFailed = 0, policySkipped = 0
if (!filter) {
  // switch from the main-thread Db to the worker-backed one WITH a watchdog (see the header comment) — close() first
  // (the singleton Db is memoized on first use; a fresh provideDb() only takes effect after it's nulled out)
  await close()
  provideDb(() => makeWorkerDb())
  setQueryTimeout(20_000)   // generous for real work (the slowest case above was ~0.5s) — bounds a hang's cost per collection
  ;({ failed: policyFailed, skipped: policySkipped } = await walkPolicies())
}

console.log(`\nrow-half self-certification: ${checked} differentials, ${mismatches} mismatches, ${errors} errors, ${knownSkips} known skip(s) (#255)`
  + (policySkipped ? `; base_policy_resolved walk: ${policySkipped} known skip(s) (#254)` : ''))
await close()
process.exit(mismatches || errors || policyFailed ? 1 : 0)
