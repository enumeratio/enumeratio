# Explore

<script setup>
import { data } from './index.data.ts'
</script>

A map of what's in the library and how the pieces relate — the families, the bijections between them, and the
counting sequences that tie them together. Written for the curious: no combinatorics background assumed. It's a
companion to the explorer, not a spec; where a claim is a known theorem it's flagged, and collections we don't have
yet are called out as **(not yet built)** so the gaps are visible too. Every collection ID below links into the
[**collection explorer**](/explore/collection/) — page through its real elements, filter, sort, inspect one in
detail.

The prose below (organizing ideas, dualities, counting-sequence bridges) is hand-written — that's mathematical
narrative the registry doesn't encode. **"The families" section is generated from the registry itself** at
docs-build time: [`docs/explore/index.data.ts`](https://github.com/enumeratio/enumeratio/blob/main/docs/explore/index.data.ts)
boots the pure-SQL core in [PGlite](https://pglite.dev) and reads `base_tag` / `base_collection_tag_manual` (the
same editorial tag layer the explorer's filter chips use), so the family list and every collection stub tracks
what's actually realized — add a collection and a tag row and it appears here on the next build, with no prose to
keep in sync.

::: tip At a glance
**{{ data.counts.collections }}** realized collections across **{{ data.counts.families }}** tag families.
:::

Two words used throughout:
- **carrier** — the data type an element *is* (a permutation is an array; a subset is a sorted list; a partition is
  a list of parts). Several collections can share one carrier.
- **grading** — how a collection is sliced into fibers by size parameters. The *same objects* under a *different
  grading* is a different, order-isomorphic collection (see "Grading grids" below).

---

## The organizing ideas

A few patterns recur across the whole library. Spot these and the 230+ collections stop looking like a list and
start looking like a small number of ideas seen from many angles.

### Grading grids → order-isomorphic siblings
One carrier often hosts several collections that differ *only* in how they're sliced. The cleanest example:

| | graded by n (everything) | graded by (n, k) |
|---|---|---|
| **subsets of [n]** | [`subsets`](/explore/collection/subsets) — all 2ⁿ (the powerset) | [`k_subsets`](/explore/collection/k_subsets) — the k-subsets, C(n,k) |
| **set partitions** | [`set_partitions`](/explore/collection/set_partitions) — Bell(n) | [`set_partitions_into_k_blocks`](/explore/collection/set_partitions_into_k_blocks) — Stirling₂(n,k) |
| **ordered set partitions** | [`set_compositions`](/explore/collection/set_compositions) / [`surjections`](/explore/collection/surjections) — Fubini(n) | [`surjections_onto_k`](/explore/collection/surjections_onto_k) — k!·S(n,k) |
| **integer partitions** | [`integer_partitions`](/explore/collection/integer_partitions) — p(n) | [`k_part_partitions`](/explore/collection/k_part_partitions) — p(n into k parts) |
| **integer compositions** | [`integer_compositions`](/explore/collection/integer_compositions) — 2ⁿ⁻¹ | [`compositions_into_k_parts`](/explore/collection/compositions_into_k_parts) — C(n−1,k−1) |

Same elements, same order, different fiber structure — **order-isomorphic siblings**. When we want a new slicing we
add a sibling rather than overload one collection. (Sage's family constructors — `SetPartitions(n)` vs
`SetPartitions(n,k)`, `OrderedSetPartitions(n)` vs `(n,k)` — are the reference for which slicings are canonical.)

### The word side of a structure
Many structures have a "word encoding" — a string that records the structure — realized as its own collection over
its own carrier, order-isomorphic to the structure:
- [`set_partitions`](/explore/collection/set_partitions) ↔ [`restricted_growth_strings`](/explore/collection/restricted_growth_strings) (RGS: the block-id of each element, `010` = {1,3}/{2})
- [`set_compositions`](/explore/collection/set_compositions) ↔ [`surjections`](/explore/collection/surjections) (the surjection word: which ordered block each element lands in)
- [`permutations`](/explore/collection/permutations) ↔ [`lehmer_codes`](/explore/collection/lehmer_codes) (the inversion table)
- [`ordered_trees`](/explore/collection/ordered_trees) ↔ [`dyck_paths`](/explore/collection/dyck_paths) (balanced parens `(())` vs up/down steps `UUDD`)

### Restriction hierarchies
A collection is often a parent filtered by a property — same carrier, a predicate carves out the sub-family. These
form little lattices:
- **[`permutations`](/explore/collection/permutations)** ⊃ [`derangements`](/explore/collection/derangements) (no fixed point), [`involutions`](/explore/collection/involutions) (self-inverse), [`even_permutations`](/explore/collection/even_permutations) (sign +1),
  [`cyclic_permutations`](/explore/collection/cyclic_permutations) (a single n-cycle), [`connected_permutations`](/explore/collection/connected_permutations) (indecomposable), [`alternating_permutations`](/explore/collection/alternating_permutations)
  (up-down), [`grassmannian_permutations`](/explore/collection/grassmannian_permutations) (≤1 descent), [`cograssmannian_permutations`](/explore/collection/cograssmannian_permutations) (≤1 ascent),
  [`baxter_permutations`](/explore/collection/baxter_permutations) (avoid the vincular 2-41-3, 3-14-2), [`simple_permutations`](/explore/collection/simple_permutations) (no non-trivial interval),
  [`non_crossing_permutations`](/explore/collection/non_crossing_permutations) (cycles form a non-crossing partition).
- **[`integer_partitions`](/explore/collection/integer_partitions)** ⊃ [`distinct_partitions`](/explore/collection/distinct_partitions), [`odd_partitions`](/explore/collection/odd_partitions), [`self_conjugate_partitions`](/explore/collection/self_conjugate_partitions),
  [`bounded_part_partitions`](/explore/collection/bounded_part_partitions), [`square_partitions`](/explore/collection/square_partitions), [`triangular_partitions`](/explore/collection/triangular_partitions).
- **[`integer_compositions`](/explore/collection/integer_compositions)** ⊃ [`odd_compositions`](/explore/collection/odd_compositions), [`palindromic_compositions`](/explore/collection/palindromic_compositions), [`carlitz_compositions`](/explore/collection/carlitz_compositions) (no two equal
  adjacent parts), [`proper_compositions`](/explore/collection/proper_compositions) (parts ≥ 2).
- **[`set_partitions`](/explore/collection/set_partitions)** ⊃ [`non_crossing_partitions`](/explore/collection/non_crossing_partitions), [`non_nesting_partitions`](/explore/collection/non_nesting_partitions).
- **[`binary_words`](/explore/collection/binary_words)** ⊃ [`binary_palindromes`](/explore/collection/binary_palindromes), [`primitive_binary_strings`](/explore/collection/primitive_binary_strings) (aperiodic), [`binary_necklaces`](/explore/collection/binary_necklaces) (lex-least
  rotation) ⊃ [`lyndon_words`](/explore/collection/lyndon_words) (aperiodic necklaces), [`binary_bracelets`](/explore/collection/binary_bracelets) (lex-least under rotation+reflection, reflection = reversal);
  [`sparse_subsets`](/explore/collection/sparse_subsets) / [`independent_sets_cycle`](/explore/collection/independent_sets_cycle) (no two adjacent 1s, on a path / a cycle). The k-ary generalisations
  [`k_necklaces`](/explore/collection/k_necklaces)/[`k_bracelets`](/explore/collection/k_bracelets)/[`k_lyndon_words`](/explore/collection/k_lyndon_words) are the same predicates over the [`words`](/explore/collection/words) carrier (base letters).

### Dualities and bijections (the theorems worth knowing)
- **Euler's theorem:** |[`distinct_partitions`](/explore/collection/distinct_partitions)(n)| = |[`odd_partitions`](/explore/collection/odd_partitions)(n)| — partitions into distinct parts and into
  odd parts are equinumerous (a classic bijection). The library asserts this directly in its examples.
- **Crossing ↔ nesting:** [`non_crossing_partitions`](/explore/collection/non_crossing_partitions) and [`non_nesting_partitions`](/explore/collection/non_nesting_partitions) are *different* sets of set
  partitions but *both* counted by Catalan — dual under an arc involution. (The lone size-4 witness: {1,3}/{2,4}
  crosses but doesn't nest; {1,4}/{2,3} nests but doesn't cross.) The same duality recurs on chord diagrams: [`non_crossing_matchings`](/explore/collection/non_crossing_matchings) vs [`non_nesting_matchings`](/explore/collection/non_nesting_matchings).
- **Grassmannian ↔ cograssmannian:** ≤1 descent vs ≤1 ascent, related by complement-reverse; both 2ⁿ−n.
- **Conjugation:** transposing a partition's Young diagram; [`self_conjugate_partitions`](/explore/collection/self_conjugate_partitions) are its fixed points.
- **RSK:** the number of [`standard_tableaux`](/explore/collection/standard_tableaux) with n cells equals the number of [`involutions`](/explore/collection/involutions) of [n] (the telephone
  numbers) — a shadow of the Robinson–Schensted correspondence. *(RSK itself is referenced but not yet a map here.)*

---

## The connective tissue: counting sequences

The strongest relationships are the numbers that show up in unrelated-looking places. Each of these is a bridge
between collections that otherwise share no structure.

- **Catalan** `1,1,2,5,14,42,…` — the library's busiest number. Counts [`dyck_paths`](/explore/collection/dyck_paths), [`ordered_trees`](/explore/collection/ordered_trees), [`binary_trees`](/explore/collection/binary_trees),
  [`non_crossing_partitions`](/explore/collection/non_crossing_partitions), [`non_nesting_partitions`](/explore/collection/non_nesting_partitions), the vertices of the [`associahedron`](/explore/collection/associahedron), and (theorem, Knuth) the
  permutations avoiding any single length-3 pattern — see the pattern-avoidance gap below.
- **Fibonacci** `1,2,3,5,8,…` — [`sparse_subsets`](/explore/collection/sparse_subsets) (binary strings with no two adjacent 1s = independent sets of the
  path Pₙ), and [`fibonacci_numbers`](/explore/collection/fibonacci_numbers).
- **Lucas** `2,3,4,7,11,18,…` — [`independent_sets_cycle`](/explore/collection/independent_sets_cycle) (independent sets of the cycle Cₙ); the cyclic cousin of
  the Fibonacci/[`sparse_subsets`](/explore/collection/sparse_subsets) line.
- **Bell / Stirling / Fubini** — the set-partition grid: Bell(n) = [`set_partitions`](/explore/collection/set_partitions), Stirling₂(n,k) =
  [`set_partitions_into_k_blocks`](/explore/collection/set_partitions_into_k_blocks), Fubini(n) = [`set_compositions`](/explore/collection/set_compositions) = [`surjections`](/explore/collection/surjections), and the surjection triangle
  k!·S(n,k) = [`surjections_onto_k`](/explore/collection/surjections_onto_k).
- **Factorial** `n!` — [`permutations`](/explore/collection/permutations), [`factorial_numbers`](/explore/collection/factorial_numbers), [`lehmer_codes`](/explore/collection/lehmer_codes), [`subexcedant_seqs`](/explore/collection/subexcedant_seqs) (both factorial-base codes for permutations), and the full-length [`arrangements`](/explore/collection/arrangements); the
  derangement numbers ([`derangements`](/explore/collection/derangements)) and telephone/involution numbers ([`involutions`](/explore/collection/involutions), [`standard_tableaux`](/explore/collection/standard_tableaux)) are its
  famous relatives; single n-cycles ([`cyclic_permutations`](/explore/collection/cyclic_permutations)) give (n−1)!.
- **Euler zigzag** `1,1,2,5,16,61,…` — [`alternating_permutations`](/explore/collection/alternating_permutations) (up-down permutations).
- **Cayley** `(n+1)ⁿ⁻¹` — [`labeled_trees`](/explore/collection/labeled_trees) and [`parking_functions`](/explore/collection/parking_functions) (equinumerous, a beautiful non-obvious fact).
- **Double factorial** `(2n−1)!!` — [`perfect_matchings`](/explore/collection/perfect_matchings) of 2n points, and the sequence itself [`double_factorial_numbers`](/explore/collection/double_factorial_numbers).
- **Powers** — 2ⁿ ([`subsets`](/explore/collection/subsets)/[`k_subsets`](/explore/collection/k_subsets)), 3ⁿ ([`signed_subsets`](/explore/collection/signed_subsets)), bⁿ ([`words`](/explore/collection/words)), 2^⌈n/2⌉ ([`binary_palindromes`](/explore/collection/binary_palindromes)).
- **Gaussian binomials (q-analogs)** — [`box_confined_partitions`](/explore/collection/box_confined_partitions) in a parts×max_part box number C(parts+max_part,
  parts); grouped by size |λ| they give the *coefficients* of the Gaussian binomial [parts+max_part choose parts]_q
  (e.g. box(2,2) → 1,1,2,1,1 = 1+q+2q²+q³+q⁴). The q-analog of the ordinary binomial that counts [`k_subsets`](/explore/collection/k_subsets).
- **Motzkin / Schröder / Delannoy** — the lattice-path cousins of Catalan: [`motzkin_paths`](/explore/collection/motzkin_paths), [`schroeder_paths`](/explore/collection/schroeder_paths),
  [`delannoy_paths`](/explore/collection/delannoy_paths), [`central_delannoy_numbers`](/explore/collection/central_delannoy_numbers), and the peak-refinement [`narayana_numbers`](/explore/collection/narayana_numbers).
- **Fuss-Catalan** `C(kn,n)/((k−1)n+1)` — [`k_dyck_paths`](/explore/collection/k_dyck_paths), the k-ary generalisation of Catalan (k=2); counts k-ary
  trees with n internal nodes. Catalan is the k=2 row.
- **Baxter** `1,1,2,6,22,92,422,…` — [`baxter_permutations`](/explore/collection/baxter_permutations) (avoiding the vincular 2-41-3, 3-14-2); the
  two-stack-sortable permutations, in bijection with pairs of twin binary trees.
- **Unsigned Stirling-1 (cycle triangle)** — [`k_cycle_permutations`](/explore/collection/k_cycle_permutations): c(n,k) permutations of [n] with k cycles;
  the row sum is n!, the same distribution as left-to-right maxima.
- **Eulerian** `A008292` — [`k_descent_permutations`](/explore/collection/k_descent_permutations): ⟨n,k⟩ permutations of [n] with k descents (equidistributed
  with excedances); each row is a palindrome and sums to n!.
- **Colored / wreath** `kⁿ·n!` — [`k_colored_permutations`](/explore/collection/k_colored_permutations) = ℤ_k ≀ Sₙ; k=1 is [`permutations`](/explore/collection/permutations) (n!), k=2 is
  [`signed_permutations`](/explore/collection/signed_permutations) (2ⁿ·n! = |Bₙ|).

---

## Connections to computer science

Several collections are the solution spaces of classic (often NP-complete) CS problems — subset sum,
maximum-independent-set, Hamiltonian path, modular square roots, sorting. Overview:
**[Connections to computer science](/learn/explorations/computer-science)**; the verified q-binomial ↔ subset-sum
connection is detailed in **[Subset sum & q-binomials](/learn/explorations/subset-sum-and-q-binomials)**.

---

## The families

Grouped by the registry's editorial tag layer (`base_tag` / `base_collection_tag_manual` — the same one the
explorer's filter chips read), generated fresh each build. Every collection carries a `fiber_symbol` (its
ambient-set notation, e.g. `Sₙ`, `2^[n]`, `C(n,k)`), so the explorer can render an element *in its set*: `1234 ∈ S₄`.
Click any collection to jump into its explorer page.

<div v-for="fam in data.families" :key="fam.tag" class="atlas-family">

### {{ fam.title }} <code class="atlas-family-count">{{ fam.collections.length }}</code>

<p v-if="fam.description" class="atlas-family-desc">{{ fam.description }}</p>

<span v-for="(c, i) in fam.collections" :key="c.id" class="atlas-stub">
<a :href="`/explore/collection/${c.id}`"><code>{{ c.id }}</code></a><span class="atlas-stub-carrier"> ({{ c.carrier }}<span v-if="c.unbounded">, unbounded</span>)</span><span v-if="i < fam.collections.length - 1">, </span>
</span>

</div>

<div v-if="data.uncategorized.length" class="atlas-family">

### Uncategorized <code class="atlas-family-count">{{ data.uncategorized.length }}</code>

<p class="atlas-family-desc">Realized but not yet given an editorial tag in <code>tags.sql</code> — mostly internal
machinery (<code>carriers</code>, <code>collections</code>, <code>traits</code>) and a few counting sequences /
notation siblings still awaiting a home.</p>

<span v-for="(c, i) in data.uncategorized" :key="c.id" class="atlas-stub">
<a :href="`/explore/collection/${c.id}`"><code>{{ c.id }}</code></a><span class="atlas-stub-carrier"> ({{ c.carrier }})</span><span v-if="i < data.uncategorized.length - 1">, </span>
</span>

</div>

<style>
.atlas-family { margin-bottom: 1.5em; }
.atlas-family-count { font-weight: normal; opacity: 0.6; font-size: 0.7em; margin-left: 0.5em; }
.atlas-family-desc { opacity: 0.8; margin: 0.25em 0 0.5em; }
.atlas-stub { font-size: 0.92em; }
.atlas-stub-carrier { opacity: 0.55; font-size: 0.85em; }
</style>

---


## Not yet built (the visible gaps)

- **Prüfer sequences** — a notation sibling borrowing the `labeled_trees` carrier, still to port. (`labeled_forests`
  and `primitive_binary_strings` are now done.)
- **Maps between collections** (RSK, cycle-type, complement/reverse bijections) as first-class objects — some map
  data exists; a full morphism layer is future work.

---

## Keeping the atlas whole

"The families" section above regenerates itself — add a collection and a `base_collection_tag_manual` row in
`tags.sql` and it appears on the next build, no prose to edit. What still needs a human hand:
- **Give it a tag** in `tags.sql`, or it lands in "Uncategorized" instead of its real family.
- **Note its counting sequence and any relationship** (an order-iso sibling, a restriction parent, a duality, a
  shared count) in the hand-written sections above — those connections are the whole point of the map, and the
  registry doesn't encode them.
- **If it fills a gap** listed in "Not yet built", move it out.

The atlas is only as useful as its narrative is current — the family listing itself can no longer drift.
