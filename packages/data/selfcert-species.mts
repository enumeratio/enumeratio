// Self-certification for the DEFINITIONAL species enumerator (#274 B7) — OPT-IN, not wired into run.mts (or
// selfcert.mts): species_structures is exponential, a slow floor/oracle rather than a gate-speed accel.
//
// For each (species, carrier collection) pair:
//   COUNT     count(species_structures(expr, [1..n])) == cardinality(coll(n))            for n = 0..NMAX
//   ROUNDTRIP for every element of coll(n): from_holdform(to_holdform(e)) == e            for n = 0..CODEC_NMAX
//   MEMBER    to_holdform(e) appears in species_structures(expr, [1..n])                  (same range)
//
//   node --import tsx selfcert-species.mts
import { openWorkerChannel, QTimeout } from './pg-worker-channel'

const NMAX = 6          // count oracle sweep, matching #274 B7's n = 0..6
const CODEC_NMAX = 5    // codec round-trip + membership sweep — bounded by fiber size (5! = 120, Bell(5) = 52)
const WATCHDOG_MS = 60_000

const channel = await openWorkerChannel({ timeoutMs: WATCHDOG_MS })
const q = channel.q

let failures = 0
const pass = (msg: string) => console.log(`  PASS  ${msg}`)
const fail = (msg: string) => { failures++; console.log(`  FAIL  ${msg}`) }

// `base`, when set, is a fixed alphabet size b: the collection is the doubly-graded words(n, b), the species is E^b,
// and the codec functions take b as a second argument (a word's letters don't reveal an unused-high-letter base).
type Species = { name: string; expr: string; coll: string; toHoldform: string; fromHoldform: string; base?: number }

const species: Species[] = [
  { name: 'permutations',   expr: 'E∘C',  coll: 'permutations',   toHoldform: 'permutation_to_holdform',   fromHoldform: 'permutation_from_holdform' },
  { name: 'set_partitions', expr: 'E∘E+', coll: 'set_partitions', toHoldform: 'set_partition_to_holdform', fromHoldform: 'set_partition_from_holdform' },
  { name: 'words (base 2)', expr: 'E^2',  coll: 'words',          toHoldform: 'word_to_holdform',          fromHoldform: 'word_from_holdform', base: 2 },
  { name: 'words (base 3)', expr: 'E^3',  coll: 'words',          toHoldform: 'word_to_holdform',          fromHoldform: 'word_from_holdform', base: 3 },
]

const labelsLiteral = (n: number): string => `ARRAY[${Array.from({ length: n }, (_, i) => i + 1).join(',')}]::int[]`
// the collection's fiber at size n (adding the fixed base for a doubly-graded word family)
const collFiber = (sp: Species, n: number): string => `${sp.coll}(${n}${sp.base === undefined ? '' : `, ${sp.base}`})`
// an encode call on element `e` (word codecs take the base as their second argument)
const toCall = (sp: Species): string => `${sp.toHoldform}(e${sp.base === undefined ? '' : `, ${sp.base}`})`

for (const sp of species) {
  console.log(`\n== ${sp.name}  (species ${sp.expr}) ==`)

  // (a) count oracle
  for (let n = 0; n <= NMAX; n++) {
    try {
      const [row] = await q<{ enum_count: string; card: string }>(`
        SELECT (SELECT count(*)::text FROM species_structures('${sp.expr}', ${labelsLiteral(n)})) AS enum_count,
               cardinality(${collFiber(sp, n)})::text AS card`)
      if (row.enum_count === row.card) pass(`count n=${n}: species_structures=${row.enum_count} == cardinality(${collFiber(sp, n)})=${row.card}`)
      else fail(`count n=${n}: species_structures=${row.enum_count} != cardinality(${collFiber(sp, n)})=${row.card}`)
    } catch (e: any) {
      if (e instanceof QTimeout) fail(`count n=${n}: TIMED OUT past ${WATCHDOG_MS / 1000}s`)
      else fail(`count n=${n}: ERROR ${e.message.split('\n')[0]}`)
    }
  }

  // (b) codec round-trip + membership
  for (let n = 0; n <= CODEC_NMAX; n++) {
    try {
      const [row] = await q<{ total: string; bad_roundtrip: string; bad_membership: string }>(`
        WITH els AS (
          SELECT (unrank(${collFiber(sp, n)}, s)).value AS e
          FROM generate_series(0, cardinality(${collFiber(sp, n)})::int - 1) s
        ),
        checked AS (
          SELECT notation(e) AS orig,
                 notation(${sp.fromHoldform}(${toCall(sp)})) AS back,
                 (${toCall(sp)} IN (SELECT * FROM species_structures('${sp.expr}', ${labelsLiteral(n)}))) AS is_member
          FROM els
        )
        SELECT count(*)::text AS total,
               count(*) FILTER (WHERE orig IS DISTINCT FROM back)::text AS bad_roundtrip,
               count(*) FILTER (WHERE NOT is_member)::text AS bad_membership
        FROM checked`)
      const total = Number(row.total)
      if (Number(row.bad_roundtrip) === 0) pass(`codec round-trip n=${n}: all ${total} element(s) of ${sp.coll}(${n}) recovered exactly`)
      else fail(`codec round-trip n=${n}: ${row.bad_roundtrip} of ${total} element(s) did NOT round-trip`)
      if (Number(row.bad_membership) === 0) pass(`codec membership n=${n}: all ${total} holdform(s) found in species_structures('${sp.expr}', [1..${n}])`)
      else fail(`codec membership n=${n}: ${row.bad_membership} of ${total} holdform(s) missing from species_structures`)
    } catch (e: any) {
      if (e instanceof QTimeout) fail(`codec n=${n}: TIMED OUT past ${WATCHDOG_MS / 1000}s`)
      else fail(`codec n=${n}: ERROR ${e.message.split('\n')[0]}`)
    }
  }
}

console.log(`\nselfcert-species: ${failures === 0 ? '✓ all PASS' : `✗ ${failures} FAILURE(S)`}`)
channel.close()
process.exit(failures ? 1 : 0)
