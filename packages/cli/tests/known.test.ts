import { afterAll, expect, it } from 'vitest'
import { provideDb, makeDb, construct, catalog, collections, close, type Fiber, type Result } from '@enumeratio/client'

// Always-on correctness gate across the PURE-SQL core (in-process PGlite, zero C), independent of sage: textbook
// (OEIS) cardinalities plus a couple of exact elements. Keeps CI honest wherever sage isn't installed. It also
// covers the pure client's family-parameter ranges + fiber/element streaming; the C-ext grade-AXIS algebra it once
// exercised (the deferred grouping tier + value-addressing) is preserved commented at the bottom.
provideDb(() => makeDb())
afterAll(() => close())

// [collection, n, |collection(n)|] — Bell, Catalan, Fibonacci-of-2, factorial, 2^n·n!, etc.
const cards: [string, number, number][] = [
  ['permutations', 4, 24],
  ['subsets', 3, 8],
  ['integer_partitions', 6, 11],
  ['integer_compositions', 5, 16],
  ['set_partitions', 4, 15],
  ['restricted_growth_strings', 4, 15], // the word side of the same Bell numbers
  ['surjections', 3, 13], // Fubini(3), the word side of set_compositions
  ['dyck_paths', 4, 14],
  ['motzkin_paths', 5, 21],
  ['binary_trees', 4, 14], // C_4 — ranking BORROWED from dyck_paths
  ['lehmer_codes', 4, 24], // 4! — the code side of permutations, with a NATIVE lex engine
  ['modular_residues', 7, 7], // Z/7Z — realized as a handle, size = the modulus
  ['arrangements', 4, 65], // A000522(4) — injective words of every length over [4]
  ['labeled_trees', 4, 16], // Cayley 4^(4-2) — the trees on [4], carried as Prüfer codes
  ['ordered_trees', 4, 14], // C_4 — rooted plane trees with 4 edges (borrows dyck's ranking)
  ['sparse_subsets', 6, 21], // F(8) — length-6 binary strings with no adjacent 1s (Zeckendorf ranking)
  ['schroeder_paths', 4, 90], // S_4 — large Schröder paths, semilength 4 (width-counting completion DP)
  ['finite_set_elements', 5, 5], // atoms of [5] — NOT 1: counts elements, not structures
  ['signed_permutations', 3, 48],
  ['standard_tableaux', 5, 26], // telephone number T(5) = Σ_λ f^λ = |involutions(5)|
  ['skew_partitions', 4, 28], // reduced skew shapes with 4 cells (sage SkewPartitions(4))
  ['decorated_permutations', 4, 65], // Σ over S_4 of 2^(fixed points)
  ['plane_partitions', 5, 24], // A000219(5) — plane partitions of 5
  ['alternating_sign_matrices', 4, 42], // A005130(4) — the ASM numbers

]

it.each(cards)('|%s(%d)| = %d', async (coll, n, card) => {
  expect(await construct(coll, { size: n }).card()).toBe(card)
})

it('permutations(4) canonical order opens at the identity', async () => {
  // the pure core's canonical serialization for a permutation is the undelimited one-line word
  expect(await construct('permutations', { size: 4 }).serialize(0, 1)).toEqual(['1234'])
})

it('a chain grade binds positionally by its axis name', async () => {
  // the pure ctor is positional (size = grade 1, then the grade chain in order); construct binds by axis NAME.
  // arrangements' chain is {size, length}, words' is {size, base}, k_subsets' is {n, k} — each secondary axis binds.
  expect(await construct('arrangements', { size: 5, length: 2 }).card()).toBe(20) // Permutations(5,2)
  expect(await construct('words', { size: 4, base: 3 }).card()).toBe(81) // 3^4
  expect(await construct('k_subsets', { size: 6, k: 3 }).card()).toBe(20) // C(6,3) — k is k_subsets' chain grade
})

it('integer_partitions(6) contains the expected partitions', async () => {
  const s = new Set(await construct('integer_partitions', { size: 6 }).serialize())
  for (const p of ['6', '5+1', '3+3', '2+2+1+1', '1+1+1+1+1+1']) expect(s, p).toContain(p)
})

it('a family-parameter range unions the fibers, and .fibers() resolves each sub-collection', async () => {
  const p = construct('permutations', { size: [1, 3] }) // sizes 1,2,3
  expect(await p.card()).toBe(9) // 1! + 2! + 3! = 1 + 2 + 6
  expect(await p.fiberCount()).toBe(3)
  const fibers = await p.fibers()
  expect(fibers.map((f) => f.params.size)).toEqual([1, 2, 3])
  expect(fibers.map((f) => f.card)).toEqual([1, 2, 6])
  expect(await fibers[2].collection.card()).toBe(6) // the size-3 fiber IS permutations(3)
})

it('a range binds any family parameter; an unbound parameter also spans fibers', async () => {
  // arrangements' chain is (size, length): fix size, range length → the union of k-arrangements (k=1,2)
  expect(await construct('arrangements', { size: 5, length: [1, 2] }).card()).toBe(25) // 5 + 20
  // an UNBOUND parameter is a full range too: k_subsets(6) leaves k ∈ [0,6] ⇒ 7 fibers, one per cardinality
  expect(await construct('k_subsets', { size: 6 }).fiberCount()).toBe(7)
})

it('default async iteration: a multi-fiber handle yields FIBERS, a single fiber yields ELEMENTS', async () => {
  const sizes: number[] = []
  for await (const x of construct('permutations', { size: [1, 3] })) sizes.push((x as Fiber).params.size)
  expect(sizes).toEqual([1, 2, 3]) // the range yielded fibers (drill in via .collection)
  const els: string[] = []
  for await (const x of construct('permutations', { size: 3 })) els.push(String((x as Result).element))
  expect(els).toEqual(['123', '132', '213', '231', '312', '321']) // the single fiber yielded elements
})

it('elements() is a lazy, globally-ordered stream; take(n) pages it', async () => {
  const first = await construct('permutations', { size: [1, 3] }).take(4)
  expect(first.map((r) => r.element)).toEqual(['1', '12', '21', '123']) // sizes 1,2,3 in global rank order
  let n = 0 // breaking out stops paging — laziness
  for await (const _ of construct('permutations', { size: 6 }).elements({ pageSize: 2 })) if (++n >= 3) break
  expect(n).toBe(3)
})

it('groupBy is a statistic distribution (the Mahonian/Stirling triangle) + per-group summaries', async () => {
  const mah = await construct('permutations', { size: 4 }).groupBy('inversions')
  expect(mah.map((r) => r.value)).toEqual([0, 1, 2, 3, 4, 5, 6])
  expect(mah.map((r) => r.count)).toEqual([1, 3, 5, 6, 5, 3, 1]) // the Mahonian row for S_4
  expect(mah.reduce((a, r) => a + r.count, 0)).toBe(24) // the counts sum to |S_4|
  expect(mah[2].stats.descents).toEqual({ min: 1, max: 2, sum: 6 }) // min/max/sum of another stat over that group
  const stir = await construct('set_partitions', { size: 5 }).groupBy('blocks')
  expect(stir.map((r) => r.count)).toEqual([1, 15, 25, 10, 1]) // the Stirling-2 row (sums to Bell(5) = 52)
})

it('catalog() introspects every realized collection (for the docs)', async () => {
  const cat = await catalog()
  expect(cat.length).toBe((await collections()).length) // one full row per realized collection
  expect(cat.length).toBeGreaterThanOrEqual(cards.length) // at least everything the gate cards
  const sp = cat.find((c) => c.id === 'set_partitions')!
  expect(sp.carrier).toBe('set_partition') // the carrier IS the structure now
  expect(sp.reprs.some((r) => r.canonical && r.id === 'rgs')).toBe(true) // canonical repr = the RGS word
})

// ── PENDING pure-client capabilities (preserved verbatim, not run) ───────────────────────────────────────────────
// The DEFERRED grouping tier — binding a NON-chain stat axis as a fiber (permutations' inversions_count/cycles_count,
// set_partitions' parts_count) — is intentionally not built: the answer is a SEPARATE named collection via
// base_restrict, not a generic binder. So the grade-axis range / gradeBy / grade_counts / aggregate-max cases below
// stay commented. Still to come under VALUE-ADDRESSING: subscripting (handle[3][0]) and the Result API
// (.get/.stat/.render/.through). NB family-parameter ranges + fiber/element streaming ARE done (above), and { k: 3 }
// already binds subsets' chain grade. lattice_paths / multisets aren't ported into the pure core yet.
/*
it('factories accept size positionally with a trailing options object', async () => {
  expect(await permutations(5).card()).toBe(120)
  expect(await construct('permutations', { size: 5, inversions_count: 4 }).card()).toBe(
    await permutations(5, { inversions_count: 4 }).card(),
  )
})

it('positional grades bind up to positional_arity (size counted)', async () => {
  expect(await arrangements(5, 2).card()).toBe(20)
  expect(await arrangements(5, 2).card()).toBe(await arrangements(5, { length: 2 }).card())
  expect(await words(4, 3).card()).toBe(81)
})

it('a positional grade past positional_arity is rejected, naming the keyword-only axes', async () => {
  await expect(permutations(5, 2).card()).rejects.toThrow(/keyword-only|inversions_count/)
  expect(await permutations(5, { inversions_count: 2 }).card()).toBe(9)
  await expect(arrangements(5, 2, 3).card()).rejects.toThrow(/positional/)
})

it('a grade range { axis: [lo, hi] } grades over the union of those fibers', async () => {
  expect(await permutations(5, { inversions_count: [2, 4] }).card()).toBe(44)
  expect(await permutations(5, { inversions_count: [3, 3] }).card()).toBe(15)
  expect(await permutations(5, { inversions_count: [0, 100] }).card()).toBe(120)
  expect(await arrangements(5, [1, 2]).card()).toBe(25)
  expect((await arrangements(5, [1, 2]).serialize()).length).toBe(25)
})

it('a handle is an async-iterable lazy stream', async () => {
  const seen: string[] = []
  for await (const row of arrangements(5, [1, 2]).elements()) seen.push(String(row.element))
  expect(seen.length).toBe(25)
  let n = 0
  for await (const _ of permutations(6)) if (++n >= 3) break
  expect(n).toBe(3)
})

it('a positional grade range is graded exactly like a named one', async () => {
  const pos = arrangements(5, [1, 2])
  const named = arrangements(5, { length: [1, 2] })
  const posFibers = (await pos.toList()) as import('@enumeratio/client').FiberRow[]
  expect(posFibers.map((f) => f.grade)).toEqual([1, 2])
  expect(await (pos as any)[2].card()).toBe(await (named as any)[2].card())
})

it('a bare-int subscript fixes the next ranged grade axis (grade_axes = the ranged axes)', async () => {
  const graded = permutations(5, { inversions_count: [2, 4] })
  expect(await graded.card()).toBe(44)
  expect(await (graded as any)[3].card()).toBe(15)
  expect(await (graded as any)[2].card()).toBe(9)
  expect(() => (graded as any)[[2, 3] as any]).toThrow(/bare int/)
  expect((await (graded as any)[3].at('0'))?.inversions_count).toBe(3)
  expect(await (arrangements(5, { length: [1, 3] }) as any)[2].card()).toBe(20)
  const el = await (graded as any)[3][0].get({ stats: ['inversions_count'] })
  expect(Object.keys(el).sort()).toEqual(['element', 'inversions_count'])
  expect(el.inversions_count).toBe(3)
  const e7 = await (permutations(5) as any)[7].get({ stats: [] })
  expect(e7.element).toBe((await permutations(5).at('7', { stats: [] }))!.element)
})

it('enumeration: a graded handle iterates FIBERS, an ungraded one ELEMENTS; .elements() flattens', async () => {
  const g = permutations(5, { inversions_count: [2, 4] })
  const fibers = (await g.toList()) as import('@enumeratio/client').FiberRow[]
  expect(fibers.map((f) => f.grade)).toEqual([2, 3, 4])
  expect(await fibers[0].collection.card()).toBe(9)
  const withCard = await g.fibers({ card: true }).next()
  expect(withCard.value?.card).toBe(9)
  expect((await g.elements().next()).value?.element).toBeTypeOf('string')
  const ungraded = await permutations(4).take(2)
  expect(ungraded.length).toBe(2)
})

it('multi-axis: two ranged grade axes grade over the Cartesian product, nested', async () => {
  const w = words({ size: [2, 3], base: [2, 3] })
  expect(await w.card()).toBe(48)
  const outer = (await w.toList()) as import('@enumeratio/client').FiberRow[]
  expect(outer.map((f) => [f.axis, f.grade])).toEqual([['size', 2], ['size', 3]])
  const inner = (await outer[0].collection.toList()) as import('@enumeratio/client').FiberRow[]
  expect(inner.map((f) => [f.axis, f.grade])).toEqual([['base', 2], ['base', 3]])
  expect(await (w as any)[2][3].card()).toBe(9)
})

it('lattice_paths: |lattice_paths(w, height=h)| = C(w+h, w)', async () => {
  expect(await construct('lattice_paths', { width: 3, height: 2 }).card()).toBe(10)
})

it('multisets: |multisets(k, ground=n)| = C(n+k-1, k) (combinations with repetition)', async () => {
  expect(await construct('multisets', { size: 3, ground: 5 }).card()).toBe(35)
  expect(await construct('multisets', { size: 2, ground: 4 }).card()).toBe(10)
})

it('gradeBy reorders the grading and marginalizes the axes left out', async () => {
  type FiberRow = import('@enumeratio/client').FiberRow
  const w = words({ size: [2, 3], base: [2, 3] })
  const byBase = (await w.gradeBy('base', 'size').toList()) as FiberRow[]
  expect(byBase.map((f) => f.axis)).toEqual(['base', 'base'])
  expect((await byBase[0].collection.toList()).map((f) => (f as FiberRow).axis)).toEqual(['size', 'size'])
  const bySize = (await w.gradeBy('size').toList()) as FiberRow[]
  expect(bySize.map((f) => f.grade)).toEqual([2, 3])
  expect(await bySize[0].collection.card()).toBe(13)
  expect(await (w.gradeBy('base') as any)[3].card()).toBe(36)
  await expect(w.gradeBy('nope').toList()).rejects.toThrow(/not a ranged axis/)
})

it('Result: eager fields read directly; stats/render/through load on demand', async () => {
  const r = (await (permutations(5) as any)[7].get({ stats: ['inversions_count'] })) as import('@enumeratio/client').Result
  expect(Object.keys(r).sort()).toEqual(['element', 'inversions_count'])
  expect(r.inversions_count).toBe(await r.stat('inversions_count'))
  expect(await r.stat('cycles_count')).toBeTypeOf('number')
  expect(String(await r.render({ repr: 'cycle' }))).toContain('(')
  const shape = await ((await (set_partitions(4) as any)[3].get()) as import('@enumeratio/client').Result).through('shape')
  expect(String(shape!.element)).toMatch(/^\d/)
})

it('grade_counts is the Stirling-2 row for set_partitions(5)', async () => {
  expect(await construct('set_partitions', { size: 5 }).gradeCounts()).toEqual([0, 1, 15, 25, 10, 1])
})

it('grade_counts is the Pascal row for subsets(4)', async () => {
  expect(await construct('subsets', { size: 4 }).gradeCounts()).toEqual([1, 4, 6, 4, 1])
})

it('aggregate sum equals |collection| (closed form), max is the row peak', async () => {
  const sp = construct('set_partitions', { size: 6 })
  expect(await sp.aggregate('sum')).toBe(await sp.card())
  expect(await permutations({ size: 4 }).aggregate('max')).toBe(6)
})
*/
