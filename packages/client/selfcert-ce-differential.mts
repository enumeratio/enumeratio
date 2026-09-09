// selfcert-ce-differential — the ORDER differential the compute-engine package's own selfcert structurally cannot
// make. That selfcert proves each family is a self-consistent bijection; this proves the CE library's `At(family, r)`
// returns the SAME element as enumeratio's SQL floor (`unrank`) at the SAME rank, for the SQL-twinned
// families. So it certifies that the ORDER the CE library enumerates in agrees with the SQL realizer — which is
// exactly what makes `sql-target.ts`'s emitted `At(...)` SQL faithful, rather than a same-sized-but-reordered
// bijection. It needs pg (the SQL floor), so it lives here in @enumeratio/client, not in the zero-dep package.
//
//   node --import tsx selfcert-ce-differential.mts
import { makeDb, provideDb, runSql, close } from './src/index.ts'
import { ComputeEngine } from '@cortex-js/compute-engine'
import { installEnumeratio } from '@enumeratio/compute-engine'

provideDb(() => makeDb())
const ce = installEnumeratio(new ComputeEngine())

// The SQL-twinned families: CE head → the pg SQL that yields the element at 0-based rank `ord` as jsonb.
// Permutations uses the bare `permutation_unrank_lex(...).image`; SymmetricGroup uses the Coxeter DP's cycles
// (flat, 0-separated — matched against CE's cycle-of-lists shape via cyclesFlatToBlocks below); the rest use
// the generic realizer's `.value` (mirrors sql-target.ts's SQL_COLLECTION).
const GENERIC: Record<string, string> = {
  IntegerCompositions: 'integer_compositions',
  IntegerPartitions: 'integer_partitions',
  PartitionsIntoKParts: 'k_part_partitions',
  SetPartitions: 'set_partitions',
  SetPartitionsIntoKBlocks: 'set_partitions_into_k_blocks',
  SetCompositions: 'set_compositions',
}
const pgSql = (head: string, p: number[], ord: number): string => {
  if (head === 'Permutations') return `to_jsonb((permutation_unrank_lex(${p[0]}::int, ${ord}::bigint)).image)`
  if (head === 'SymmetricGroup') return `to_jsonb((to_cycles(symmetric_group_unrank_by_coxeter(${p[0]}::int, ${ord}::bigint))).cycles)`
  const args = p.map((x) => `${x}::int`).join(', ')
  return `to_jsonb((unrank(${GENERIC[head]}(${args}), ${ord}::bigint)).value)`
}

// Parameter grids: 1-arg families sweep n; the two 2-arg families sweep (n, k) with k ≤ n.
const oneArg = (ns: number[]) => ns.map((n) => [n])
const grids: Record<string, number[][]> = {
  Permutations: oneArg([0, 1, 2, 4, 5, 6]),
  SymmetricGroup: oneArg([0, 1, 2, 4, 5, 6]),
  IntegerCompositions: oneArg([0, 1, 3, 5, 7]),
  IntegerPartitions: oneArg([0, 1, 4, 6, 8]),
  SetPartitions: oneArg([0, 1, 3, 4, 5]),
  SetCompositions: oneArg([0, 1, 3, 4]),
  PartitionsIntoKParts: [[6, 2], [6, 3], [8, 3], [9, 4], [7, 1]],
  SetPartitionsIntoKBlocks: [[5, 2], [6, 3], [6, 2], [7, 3]],
}

/** pg's flat 0-separated cycles array (`permutation_cycles.cycles`) → CE's cycle-of-lists shape. */
function cyclesFlatToBlocks(flat: number[]): number[][] {
  const out: number[][] = []
  let cur: number[] = []
  for (const x of flat) {
    if (x === 0) { if (cur.length) out.push(cur); cur = [] }
    else cur.push(x)
  }
  if (cur.length) out.push(cur)
  return out
}

/** A boxed CE element → a nested JS array of plain ints (List → array, number → int). */
function ceElt(boxed: any): any {
  if (boxed?.operator === 'List') return (boxed.ops ?? []).map(ceElt)
  const n = boxed?.re ?? boxed?.value ?? boxed?.numericValue
  return typeof n === 'bigint' ? Number(n) : Number(n)
}
/** An RGS (restricted growth string, 0-based block id per element) → CE's block form: 1-based elements gathered
 *  into blocks, each block ascending, blocks ordered by first appearance (= by least element). */
function rgsToBlocks(rgs: number[]): number[][] {
  const blocks: number[][] = []
  rgs.forEach((b, i) => { (blocks[b] ??= []).push(i + 1) })
  return blocks
}
/** Set-composition `labels` (1-based ORDERED-block index per element) → CE's ordered block form. */
function labelsToBlocks(labels: number[]): number[][] {
  const blocks: number[][] = []
  labels.forEach((b, i) => { (blocks[b - 1] ??= []).push(i + 1) })
  return blocks
}
/** pg's to_jsonb result → the SAME canonical nested-int shape the CE library emits, so the comparison is about
 *  ENUMERATION ORDER, not encoding: the SQL `.value` is a carrier composite (`{parts}` for (weak) compositions and
 *  partitions, `{rgs}` for set partitions/blocks, `{blocks}` for set compositions) while CE emits the bare list /
 *  block-of-lists. NULL (empty S₀ image / empty value) normalizes to []. */
function pgElt(v: unknown): any {
  const j = typeof v === 'string' ? JSON.parse(v) : v
  if (j == null) return []
  if (Array.isArray(j)) return j // Permutations: a bare image int[]; SymmetricGroup: a bare flat cycles int[] (caller splits on 0)
  if (Array.isArray(j.parts)) return j.parts // compositions / partitions
  if (Array.isArray(j.rgs)) return rgsToBlocks(j.rgs) // set partitions / set-partitions-into-k-blocks
  if (Array.isArray(j.labels)) return labelsToBlocks(j.labels) // set compositions (ordered blocks)
  if (Array.isArray(j.blocks)) return j.blocks
  return j
}

/** Ranks to compare at a given count: endpoints, midpoint, and a few interior points — enough to catch a
 *  truncation or an off-by-one without enumerating the whole (pglite-slow) family. */
function sampleRanks(count: number): number[] {
  if (count <= 0) return []
  const s = new Set<number>([0, count - 1, Math.floor(count / 2), 1, count - 2, Math.floor(count / 3)])
  return [...s].filter((r) => r >= 0 && r < count)
}

let checks = 0
const fails: string[] = []

for (const [head, params] of Object.entries(grids)) {
  for (const p of params) {
    const count = Number((ce.box(['Length', [head, ...p]] as any).evaluate() as any).re)
    for (const r of sampleRanks(count)) {
      const our = ceElt(ce.box(['At', [head, ...p], r + 1] as any).evaluate())
      const rows = (await runSql(`SELECT ${pgSql(head, p, r)} AS v`)) as Record<string, unknown>[]
      const rawSql = pgElt(rows[0]?.v)
      const sql = head === 'SymmetricGroup' ? cyclesFlatToBlocks(rawSql) : rawSql
      checks++
      const a = JSON.stringify(our), b = JSON.stringify(sql)
      if (a !== b) fails.push(`${head}(${p}) rank ${r}:  CE ${a}  ≠  SQL ${b}`)
    }
  }
}

console.log(`ce↔sql order differential: ${checks} (family, rank) points across ${Object.keys(grids).length} families`)
if (fails.length) {
  console.log(`\n${fails.length} MISMATCHES (CE enumeration order disagrees with the SQL floor):`)
  for (const f of fails.slice(0, 40)) console.log('  ✗', f)
  await close()
  process.exit(1)
}
console.log('✓ CE `At` agrees with the SQL `unrank` element-for-element at every sampled rank')
await close()
