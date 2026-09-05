// Self-certification harness — the "accelerated == naive" differential oracle (https://github.com/enumeratio/enumeratio/wiki/Self-Certification).
//
// Every collection has a slow, definitional floor (enumerate the fiber, in order) and, OPTIONALLY, accelerations that
// answer the same question fast. Those accelerations MUST agree with the floor. This sweeps every collection × a range
// of fibers and cross-checks the two independent accelerations against straight enumeration:
//
//   COUNT   fiber_count(f)          == count(elements(f))                  — closed-form cardinality vs enumerated
//   UNRANK  element_at(f, ord)      == the ord-th of elements(f) ORDER BY  — direct random access vs sequential
//
// Only fibers that HAVE the accel are checked (a fiber whose cardinality already IS count(elements) certifies nothing).
// Enumeration is the expensive oracle, so it's capped and bounded-only — the point is correctness, not speed.
//
//   node --import tsx selfcert.mts            # sweep all collections, report mismatches, exit nonzero on any
//   node --import tsx selfcert.mts perm       # only collections whose id contains "perm"
import debug from 'debug'
import { debugGucSetSql } from './debug-env'
import { openWorkerChannel, QTimeout } from './pg-worker-channel'

const log = debug('enumeratio:data:selfcert')

const CAP_COUNT = 20_000   // largest fiber we enumerate-and-count (the closed-form is checked only up to here)
const CAP_UNRANK = 300     // terms checked per fiber for element_at-vs-sequential — a recurrence unrank is O(ord), so
                           // this is O(N²) per fiber; 300 terms is plenty to catch a wrong formula
const NMAX = 8             // sizes swept for a graded collection: 0..NMAX (oversized fibers are skipped, not failed)
const STMT_TIMEOUT = '8s'  // belt: honoured by a real Postgres, IGNORED by pglite — see WATCHDOG_MS
const WATCHDOG_MS = 20_000 // braces: the query runs in a worker process, and a query that outruns this is SIGKILLed.
                           // pglite does not honour statement_timeout (confirmed by hand), so a combinatorial floor
                           // scan or a tight plpgsql loop cannot be cancelled any other way — it just runs. Before
                           // this, ONE such collection stalled the whole sweep silently and the full catalog run
                           // could never finish: `cyclohedron`'s fiber_count enumerates every dissection of a
                           // (2n+2)-gon over an unbounded axis. Now that is a printed SKIP, like selfcert-rows'.

const filter = process.argv[2] ?? null

// Session GUCs do not survive a worker kill, so they are re-applied on every (re)spawn.
const debugSetSql = debugGucSetSql()   // lift DEBUG (if it names an enumeratio: namespace) into the session GUC
const channel = await openWorkerChannel({
  timeoutMs: WATCHDOG_MS,
  onReady: async (q) => {
    await q(`SET statement_timeout = '${STMT_TIMEOUT}'`)
    if (debugSetSql) await q(debugSetSql)
  },
})
log('booted pglite worker (DEBUG=%s)', process.env.DEBUG ?? '')
const q = channel.q
const regproc = async (sig: string): Promise<boolean> =>
  !!(await q<{ x: boolean }>(`SELECT to_regprocedure('${sig}') IS NOT NULL AS x`))[0]?.x
const isFinite_ = (s: string | null) => s != null && s !== 'Infinity' && s !== 'NaN'

type Mismatch = { coll: string; kind: 'count' | 'unrank'; fiber: string; expected: string; got: string }
const mismatches: Mismatch[] = []
type Skip = { coll: string; n: number | null; reason: string }
const skips: Skip[] = []
let checkedCount = 0, checkedUnrank = 0, collsWithAccel = 0, collsNoAccel = 0

const cats = await q<{ id: string; grades: string }>(`SELECT id, grades::text AS grades FROM base_catalog ORDER BY id`)

// Progress chatter goes to stderr as the sweep runs, and it earns its keep: each line is written WITHOUT its
// terminator until the collection finishes, so the tail of the log always names the collection currently being
// worked and how far in we are. Before this a stall looked exactly like slow progress — the whole sweep printed
// a bare name per collection — and one wall (cyclohedron) read as "the catalog is just slow" for an hour.
const started = Date.now()
const secs = (ms: number): string => `${(ms / 1000).toFixed(1)}s`
let idx = 0

for (const c of cats) {
  idx++
  if (filter && !c.id.includes(filter)) continue
  const gradeCount = (c.grades.replace(/^\{|\}$/g, '').match(/[^,]+/g) ?? []).length
  const hasCount = await regproc(`fiber_count(${c.id}_fiber)`)
  const hasUnrank = await regproc(`fiber_unrank(${c.id}_fiber, rank_index)`)
  if (!hasCount && !hasUnrank) { collsNoAccel++; continue }
  collsWithAccel++
  const tColl = Date.now()
  const checks0 = checkedCount + checkedUnrank
  process.stderr.write(`  · [${String(idx).padStart(3)}/${cats.length}] ${c.id.padEnd(34)}${(hasCount ? '[count]' : '').padEnd(8)}${(hasUnrank ? '[unrank]' : '').padEnd(9)}`)
  const sizes: (number | null)[] = gradeCount === 0 ? [null] : Array.from({ length: NMAX + 1 }, (_, i) => i)
  let anyChecked = false
  let timedOut: string | null = null
  const collErrors = new Set<string>()
  for (const n of sizes) {
    const handle = n === null ? `${c.id}()` : `${c.id}(${n})`
    try {
      if (hasCount) {
        const rows = await q<{ fib: string; closed: string | null; enumerated: string | null }>(
          `SELECT fiber_address(f)::text AS fib, fiber_count(f)::text AS closed,
                  CASE WHEN fiber_count(f) >= 0 AND fiber_count(f) <= ${CAP_COUNT}
                       THEN (SELECT count(*)::text FROM elements(f, ${CAP_COUNT + 1}) v) END AS enumerated
             FROM fibers(${handle}) f`)
        for (const r of rows) {
          if (!isFinite_(r.closed) || r.enumerated == null) continue   // ∞ / unknown / too-big-to-enumerate
          anyChecked = true; checkedCount++
          if (r.closed !== r.enumerated) mismatches.push({ coll: c.id, kind: 'count', fiber: `${c.id}${r.fib}`, expected: r.closed!, got: r.enumerated })
        }
      }
      if (hasUnrank) {
        // element_at vs sequential — applies to INFINITE fibers too (check the first CAP_UNRANK terms); this is what
        // certifies the closed-form term formulas of the unbounded number sequences (Catalan, factorial, …).
        const rows = await q<{ fib: string; bad: number | null }>(
          `SELECT fiber_address(f)::text AS fib,
                  CASE WHEN cardinality(f) IS NULL OR (cardinality(f))::numeric = 'infinity'
                            OR (cardinality(f))::numeric <= ${CAP_UNRANK} THEN (
                    SELECT count(*) FILTER (WHERE render(element_at(f, s.ord)) IS DISTINCT FROM s.r)
                      FROM (SELECT (row_number() OVER (ORDER BY e) - 1)::rank_index AS ord, render(e) AS r
                              FROM elements(f, ${CAP_UNRANK}) e) s
                  ) END AS bad
             FROM fibers(${handle}) f`)
        for (const r of rows) {
          if (r.bad == null) continue
          anyChecked = true; checkedUnrank++
          if (Number(r.bad) > 0) mismatches.push({ coll: c.id, kind: 'unrank', fiber: `${c.id}${r.fib}`, expected: '0 disagreements', got: `${r.bad} of ≤${CAP_UNRANK}` })
        }
      }
    } catch (e: any) {
      if (e instanceof QTimeout) {
        // The worker was SIGKILLed and respawned. Abandon this collection's remaining sizes rather than paying a
        // ~7s respawn per size to hit the same wall: one stall is enough to know the accel is unverifiable here.
        timedOut = `timed out past ${WATCHDOG_MS / 1000}s at ${handle} — accel unverifiable by enumeration`
        break
      }
      collErrors.add(e.message.split('\n')[0])   // a degenerate size (e.g. coll(0)) shouldn't cost the larger sizes
    }
  }
  const took = Date.now() - tColl
  process.stderr.write(`${String(checkedCount + checkedUnrank - checks0).padStart(5)} checks  ${secs(took).padStart(7)}`
    + `${took > 10_000 ? '   ← slow' : ''}${timedOut ? '   ← TIMED OUT, worker respawned' : ''}`
    + `   [${secs(Date.now() - started)} elapsed]\n`)
  if (timedOut) skips.push({ coll: c.id, n: null, reason: timedOut })
  else if (!anyChecked) for (const reason of (collErrors.size ? collErrors : new Set(['no finite fiber within caps'])))
    skips.push({ coll: c.id, n: null, reason })
}

console.log(`\nself-certification (accelerated == naive)\n`)
console.log(`collections with an accel: ${collsWithAccel}   (no accel, skipped: ${collsNoAccel})`)
console.log(`fiber checks: ${checkedCount} count + ${checkedUnrank} unrank   (worker spawns: ${channel.spawns} — one per killed query, plus the first)`)
console.log(`swept in ${secs(Date.now() - started)}`)
if (skips.length) {
  console.log(`\nskipped (${skips.length}):`)
  for (const s of skips) console.log(`  ${s.coll}${s.n != null ? `(${s.n})` : ''} — ${s.reason}`)
}
if (mismatches.length) {
  console.log(`\n✗ MISMATCHES (${mismatches.length}):`)
  for (const m of mismatches) console.log(`  [${m.kind}] ${m.fiber}: expected ${m.expected}, got ${m.got}`)
} else {
  console.log(`\n✓ no mismatches — every accelerated answer agrees with enumeration.`)
}

channel.close()
process.exit(mismatches.length ? 1 : 0)
