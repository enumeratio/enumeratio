# Lattice paths & trees

Three families, none of them looking remotely alike, all counted by the exact same number. That number is the
**Catalan number** $C_n = \frac{1}{n+1}\binom{2n}{n} = 1,1,2,5,14,42,\dots$ — one of the most-repeated sequences
in all of combinatorics, and this chapter shows why it shows up here three times over.

## Dyck paths — steps that never go negative

A **Dyck path** of semilength $n$ is a sequence of $n$ up-steps and $n$ down-steps that never dips below where
it started. Semilength 3 has $C_3 = 5$ of them; rank 0 is the one that goes all the way up before coming down:

<enumeratio-assert-summary label="lattice-paths & trees checks"></enumeratio-assert-summary>

<p>
<enumeratio-assert expect="UUUDDD" reveal="always" label="dyck_paths(3) rank 0">
  <enumeratio-notation collection="dyck_paths" n="3" rank="0"></enumeratio-notation>
</enumeratio-assert>
</p>

<p>
<enumeratio-figure collection="dyck_paths" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="dyck_paths" n="3" rank="1"></enumeratio-figure>
<enumeratio-figure collection="dyck_paths" n="3" rank="2"></enumeratio-figure>
<enumeratio-figure collection="dyck_paths" n="3" rank="3"></enumeratio-figure>
<enumeratio-figure collection="dyck_paths" n="3" rank="4"></enumeratio-figure>
</p>

That "never below the start" constraint is doing all the work — drop it and you'd just have $\binom{2n}{n}$
unconstrained up/down words; keeping it is exactly what cuts that down to $C_n$.

## Binary trees — the same count, a different shape

A **[binary tree](/explore/collection/binary_trees)** with $n$ internal nodes (each with a left and right child,
possibly empty) is *also* counted by $C_n$:

<enumeratio-figure collection="binary_trees" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="binary_trees" n="3" rank="2"></enumeratio-figure>

## Ordered trees — and a word encoding, again

A rooted tree where a node's children have a left-to-right order — an **[ordered
tree](/explore/collection/ordered_trees)** — is the same count once more, and it connects straight back to the
last chapter's idea: read an ordered tree as balanced parentheses (`(` on the way down to a child, `)` on the
way back up) and you get exactly a Dyck path's up/down word. [`ordered_trees`](/explore/collection/ordered_trees) and [`dyck_paths`](/explore/collection/dyck_paths) are
order-isomorphic siblings, the same way [`set_partitions`](/explore/collection/set_partitions) and its RGS encoding were.

<enumeratio-figure collection="ordered_trees" n="3" rank="0"></enumeratio-figure>
<enumeratio-figure collection="ordered_trees" n="3" rank="2"></enumeratio-figure>

## Why the same number keeps showing up

Dyck paths, binary trees, ordered trees — and, it turns out, non-crossing partitions, triangulations of a
polygon, and stack-sortable permutations too — are all in bijection with each other, which is *why* one closed
form counts them all. Two of those correspondences are worked all the way through, with real coordinates, in
**[Polytopes & their combinatorics](/learn/explorations/polytopes)**: the **sylvester map** turns a permutation into a binary
tree, and its geometric shadow is the **Tonks projection** from the permutahedron down onto the associahedron —
the polytope whose vertices *are* the triangulations.

## The idea underneath all five chapters

Look back over this tour: [`k_subsets`](/explore/collection/k_subsets) and [`subsets`](/explore/collection/subsets) were the same objects sliced by size. [`restricted_growth_strings`](/explore/collection/restricted_growth_strings)
and [`set_partitions`](/explore/collection/set_partitions) were the same collection, written two ways. Dyck paths, binary trees, and ordered trees are
three shapes for the same count. None of that is a coincidence the library stumbled into — it's the thing
enumeratio is *for*: a bijection or a shared closed form is stored once and referenced by every family it
connects, rather than rediscovered separately in each one. [The vision](/develop/) makes that argument in full;
you've now seen it happen five times.

Next, and last: **[Where next](/learn/guides/where-next)** — the map back out to everything this tour only pointed at.
