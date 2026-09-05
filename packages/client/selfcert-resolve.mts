// Self-certification — the CONSTRUCTION-FROM resolver: a FROM that names a construction + binds its type parameter
// (finsets_of(fin(4)), maps_of(fin(n), fin(n))) MUST resolve to the realized collection it's sugar for, with the SAME
// elements/cardinality. O.1 (construction-FROM as sugar), O.2 model i (α picks the ground → coarsest instance), O.6
// (plural `_of`). Sibling of selfcert-rows.mts; reads base_construction.from_name + per-position base_alpha.
// Opt-in:   node --import tsx selfcert-resolve.mts
import { provideDb, makeDb, resolveFrom, toHandle, runSql, close } from './src/index.ts'

provideDb(() => makeDb())

type Case = { from: string; expect: string; sameAs?: string; relabel?: boolean }
const cases: Case[] = [
  { from: 'finsets_of(natural_number)', expect: 'finsets' },                       // former ℕ → the ℕ-ground instance
  { from: 'finsets_of(fin(n))',         expect: 'subsets' },                        // generic Fin → coarsest (NOT k_subsets)
  { from: 'finsets_of(fin(4))',         expect: 'subsets(n=4)', sameAs: 'subsets(4)' }, // constant Fin → bind the ground axis
  { from: 'multisets_of(fin(n))',       expect: 'multisets' },
  // the maps family α → β: words are maps [size] → [base]; the diagonal β = α is endofunctions; a pinned codomain is an alias
  { from: 'maps_of(fin(m), fin(n))',    expect: 'words' },                          // two distinct symbols → the generic instance
  { from: 'maps_of(fin(n), fin(n))',    expect: 'endofunctions' },                  // the SAME symbol twice → the diagonal
  { from: 'maps_of(fin(4), fin(4))',    expect: 'endofunctions(n=4)', sameAs: 'words(4, 4)', relabel: true },
  { from: 'maps_of(fin(n), fin(2))',    expect: 'binary_words' },                   // pinned codomain 2 → the alias (own 0/1 carrier)
  { from: 'maps_of(fin(3), fin(2))',    expect: 'binary_words(n=3)', sameAs: 'words(3, 2)', relabel: true },
  { from: 'maps_of(fin(n), fin(3))',    expect: 'signed_subsets' },                 // {absent, +, −}: a signed subset IS a map into Fin 3
  { from: 'maps_of(fin(4), fin(3))',    expect: 'signed_subsets(n=4)', sameAs: 'words(4, 3)', relabel: true },
  // products: a collection-former fills each hole; the wreath product and its k = 2 alias
  { from: 'products_of(permutations(n), words(n, k))', expect: 'k_colored_permutations' },
  { from: 'products_of(permutations(n), words(n, 2))', expect: 'signed_permutations' },       // pinned colours → the alias
  { from: 'products_of(permutations(4), words(4, 2))', expect: 'signed_permutations(size=4)', sameAs: 'k_colored_permutations(4, 2)', relabel: true },
  { from: 'products_of(permutations(4), words(4, 3))', expect: 'k_colored_permutations(size=4, colors=3)', sameAs: 'k_colored_permutations(4, 3)' },
]

// build the SQL handle for a FROM text (toHandle resolves a construction-FROM), then read its elements / cardinality
const builtOf = async (fromText: string): Promise<string> => (await toHandle(fromText)).built()
async function elemSet(built: string): Promise<string[]> {
  return (await runSql<{ e: string }>(`SELECT notation((e).value) AS e FROM elements(${built}, 100000) e`)).map((r) => r.e).sort()
}
async function card(built: string): Promise<string> {
  return (await runSql<{ c: string }>(`SELECT cardinality(${built})::text AS c`))[0].c
}

let pass = 0, fail = 0
for (const c of cases) {
  try {
    const got = await resolveFrom(c.from)
    if (got !== c.expect) { console.log(`✗ ${c.from.padEnd(28)} → ${got} (expected ${c.expect})`); fail++; continue }
    const built = await builtOf(c.from)   // resolves + builds the SQL handle (must not throw)
    let detail = ''
    if (c.sameAs && !c.relabel) {
      const [a, b] = [await elemSet(built), await elemSet(await builtOf(c.sameAs))]
      if (a.length !== b.length || !a.every((x, i) => x === b[i])) { console.log(`✗ ${c.from.padEnd(28)} → ${got} elements DIFFER from ${c.sameAs}`); fail++; continue }
      detail = `elements == ${c.sameAs}`
    } else if (c.sameAs && c.relabel) {
      // carriers differ (0/1 vs 1/2 letters; images vs letters) — compare cardinalities of the fully bound handles
      const [a, b] = [await card(built), await card(await builtOf(c.sameAs))]
      if (a !== b) { console.log(`✗ ${c.from.padEnd(28)} → ${got} |${got}|=${a} ≠ |${c.sameAs}|=${b}`); fail++; continue }
      detail = `|${got}| == |${c.sameAs}| = ${a} (up to relabel)`
    }
    console.log(`✓ ${c.from.padEnd(28)} → ${got.padEnd(14)} ${detail}`)
    pass++
  } catch (e) { console.log(`✗ ${c.from.padEnd(28)} threw: ${(e as Error).message}`); fail++ }
}

// arity and instance errors must be honest, not silent fall-throughs to a plain handle
for (const bad of ['maps_of(fin(n))', 'words_of(fin(2))', 'finsets_of(fin(n), fin(n))', 'products_of(permutations(n), fin(2))', 'sums_of(permutations(n), words(n, 2))']) {
  try { await toHandle(bad); console.log(`✗ ${bad.padEnd(28)} unexpectedly built`); fail++ }
  catch (e) { console.log(`✓ ${bad.padEnd(28)} → rejected: ${(e as Error).message.split('\n')[0]}`); pass++ }
}

console.log(`\n${fail ? '✗' : '✓'} ${pass} passed, ${fail} failed`)
await close()
process.exit(fail ? 1 : 0)
