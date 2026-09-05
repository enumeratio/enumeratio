# Bijections — a registry, not a search

Sage's [`bijectionist`](https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/bijectionist.html) module
*searches* for a bijection between two sets satisfying constraints you give it — a solver. enumeratio takes the
opposite stance: every bijection here is **hand-constructed once and registered as a fact** —
a `base_map` row naming the forward function, its inverse, and whether it preserves rank — rather than discovered
on demand. Different tools for different jobs, but the same underlying object: a verified, invertible
correspondence between two combinatorial sets. This page is a tour of what's registered.

## The shape of a registered bijection

Each row in `base_map` names a `mapping_fn`, a `codomain` collection, and two flags:

- **`is_bijection`** — the map has a genuine inverse (also registered), checked round-trip in the example suite.
  $22$ such maps are registered across the catalog today.
- **`is_order_iso`** — the strongest claim: the map preserves **rank**. The $k$-th element of the source *is*, via
  the map, the $k$-th element of the target. Only $2$ maps currently claim this — it's a high bar, because it
  means one family can **borrow** the other's entire ranking rather than just corresponding pointwise.

The full list, generated from the registry, is in the [API reference's map
section](/develop/api#representations-stats-maps-—-the-catalog-facets); this page picks out the ones worth seeing
work.

## Order-isomorphism: borrowing a ranking

**[`k_subsets`](/explore/collection/k_subsets)** and **[`binary_words_by_weight`](/explore/collection/binary_words_by_weight)**
are order-isomorphic via the **combinatorial number system**: a $k$-subset of $[n]$ *is* a weight-$k$ binary word
of length $n$ (one bit per element, set where the element is a member) — read in reverse order:

<p>
<enumeratio-notation collection="k_subsets" n="5" rank="8"></enumeratio-notation>
&nbsp;→&nbsp;
<enumeratio-notation collection="binary_words_by_weight" n="5" rank="8"></enumeratio-notation>
</p>

Because this map is rank-preserving, [`binary_words_by_weight`](/explore/collection/binary_words_by_weight) never had to write its own ranking formula — it
inherits [`k_subsets`](/explore/collection/k_subsets)'s, through the map. This is the "one identity, many roles" idea from [the
vision](/develop/#_2-one-identity-many-roles) made concrete: the ranking is written once.

## Euler's theorem, as a computed map

Partitions into **distinct** parts and partitions into **odd** parts are equinumerous — a classical theorem
(Euler, refined by Glaisher into an explicit bijection: split each even part in half repeatedly until every part
is odd, then re-merge equal odd parts by doubling). It's registered as `euler_distinct_to_odd`, with
`euler_odd_to_distinct` its inverse:

<p>
<enumeratio-notation collection="distinct_partitions" n="8" rank="2"></enumeratio-notation>
&nbsp;→&nbsp;
<enumeratio-notation collection="odd_partitions" n="8" rank="2"></enumeratio-notation>
</p>

$6 = |\text{distinct\_partitions}(8)| = |\text{odd\_partitions}(8)|$ — not a coincidence the library asserts once
and forgets; every element on one side has a named, computed partner on the other.

## Crossing and nesting, swapped

[The atlas](/explore/#dualities-and-bijections-the-theorems-worth-knowing) names the one witness at $n=4$
where a non-crossing and a non-nesting partition of $[4]$ are related by the crossing↔nesting swap rather than
being equal outright. Here it is, live — $\{1,4\},\{2,3\}$ (nests: block $\{2,3\}$ sits entirely inside the span
of $\{1,4\}$) swapping to $\{1,3\},\{2,4\}$ (crosses: the blocks interleave):

<p>
<enumeratio-notation collection="non_crossing_partitions" n="4" rank="7"></enumeratio-notation>
&nbsp;→&nbsp;
<enumeratio-notation collection="non_nesting_partitions" n="4" rank="5"></enumeratio-notation>
</p>

Both [`non_crossing_partitions`](/explore/collection/non_crossing_partitions) and [`non_nesting_partitions`](/explore/collection/non_nesting_partitions) are counted by the same Catalan number, and this map
is *why* — it's a bijection between them, not just two families that happen to share a count.

## More in the registry

A few more, browsable in the [explorer](/explore/collection/) (pick a collection, its **Maps** panel lists what
it borrows or lends):

- **RSK** — [`permutations`](/explore/collection/permutations) ↔ [`standard_tableau_pairs`](/explore/collection/standard_tableau_pairs), worked through in full (with the hook-length formula and
  the Schützenberger symmetry) in [Young tableaux & partition algebras](/learn/explorations/tableaux#rsk-permutations-↔-pairs-of-tableaux).
- **Zeckendorf representation** — [`natural_numbers`](/explore/collection/natural_numbers) ↔ [`fib_strings`](/explore/collection/fib_strings), every natural number as a sum of
  non-consecutive Fibonacci numbers, encoded as a binary string.
- **Increasing binary trees ↔ permutations** — inorder traversal one way, a minimum-splitting recursion the
  other.
- **Sylvester map** — [`permutations`](/explore/collection/permutations) → [`binary_trees`](/explore/collection/binary_trees) (insert into a binary search tree, keep the shape), the
  map behind the Tonks projection in [Polytopes & their combinatorics](/learn/explorations/polytopes#the-maps-a-glossary).
