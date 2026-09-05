# Set partitions

A **partition of a set** $[n] = \{1,\dots,n\}$ splits every element into exactly one non-empty **block** — no
element left over, no element in two blocks at once. This page walks the standard presentations of that object —
notation, counting, and the refinement lattice — the way a reference article would, but every figure below is
drawn live from the actual collection, not a static illustration.

## The object

Take $\{1,2,3,4\}$ split into $\{1,2\}$, $\{3\}$, $\{4\}$ — three blocks. enumeratio draws a set partition as an
**arc diagram**: one point per element, an arc joining two points exactly when they're consecutive members of the
same block.

<enumeratio-figure collection="set_partitions" n="4" rank="4"></enumeratio-figure>

## Notation — the restricted growth string

The canonical text form reads, for each element in turn, *which block it's in* — numbering blocks by the order
they're first seen. $\{1,2\},\{3\},\{4\}$ becomes `0012`: elements 1 and 2 share block `0`, then block `1`, then
block `2`. This is the **restricted growth string** (RGS), and it's "restricted" because a new block number can
only ever be one more than the largest used so far — you can't open block `2` before block `1` exists.

$[3]$ is small enough to show every restricted growth string it has:

<p>
<enumeratio-notation collection="set_partitions" n="3" rank="0"></enumeratio-notation> — one block, everything together &nbsp;·&nbsp;
<enumeratio-notation collection="set_partitions" n="3" rank="2"></enumeratio-notation> — $\{1,3\},\{2\}$ &nbsp;·&nbsp;
<enumeratio-notation collection="set_partitions" n="3" rank="4"></enumeratio-notation> — every element its own block
</p>

[`restricted_growth_strings`](/explore/collection/restricted_growth_strings) realizes this string as its *own* collection, order-isomorphic to [`set_partitions`](/explore/collection/set_partitions) —
see [Words & compositions](/learn/guides/words-and-compositions) for that pairing worked through live.

## How many — the Bell numbers

The count of all partitions of $[n]$ is the **Bell number** $B_n$:

$$ B_0, B_1, B_2, \dots = 1, 1, 2, 5, 15, 52, 203, \dots $$

each verified as `cardinality(set_partitions(n))` in the library's own example suite — no separate reference table
to keep in sync. Splitting by **block count** refines that sum: the number of partitions of $[4]$ into exactly $k$
blocks is the **Stirling number of the second kind** $S(4,k)$, realized as
[`set_partitions_into_k_blocks`](/explore/collection/set_partitions_into_k_blocks):

$$ S(4,1), S(4,2), S(4,3), S(4,4) = 1, 7, 6, 1, \qquad \textstyle\sum_k S(4,k) = 15 = B_4. $$

## The refinement order — a partition lattice

Say partition $p$ **refines** $q$ when every block of $p$ sits inside a single block of $q$ — $p$ is $q$ cut into
smaller pieces. Ordering all of $\Pi_n$ (the partitions of $[n]$) by refinement makes it a **lattice**: the
all-singletons partition is its bottom, the one-block partition its top, and a **cover** (an edge with nothing
between) is exactly two blocks of $p$ merging into one. The library carries this as data — a registered element
relation on [`set_partitions`](/explore/collection/set_partitions), not just prose — so the diagram below is generated from the same
`set_partition_refinement_covers` the library's own examples check, at $n=3$ and $n=4$:

<ClientOnly><HasseDiagram collection="set_partitions" rel="refinement" :n="3" title="refinement order Π₃" /></ClientOnly>
<ClientOnly><HasseDiagram collection="set_partitions" rel="refinement" :n="4" title="refinement order Π₄" /></ClientOnly>

$\Pi_3$ has 5 nodes (=$B_3$) and $\Pi_4$ has 15 (=$B_4$) — every node in these diagrams is a real element of
[`set_partitions`](/explore/collection/set_partitions), and every edge a real covering pair, not a hand-drawn approximation.

## Restricting to non-crossing

Draw the $n$ points of $[n]$ on a circle instead of a line: a partition is **non-crossing** if no two of its
blocks' connecting arcs cross. [`non_crossing_partitions`](/explore/collection/non_crossing_partitions) is exactly
that restriction of [`set_partitions`](/explore/collection/set_partitions), and it's counted by the **Catalan numbers** rather than the Bell numbers —
$14$ of them at $n=4$, not $15$:

<ClientOnly><HasseDiagram collection="non_crossing_partitions" rel="refinement" :n="4" title="the non-crossing lattice NC₄"/></ClientOnly>

$NC_4$ is $\Pi_4$ with exactly one element removed — the partition $\{1,3\},\{2,4\}$, the lone crossing witness at
this size. The [atlas's duality section](/explore/#dualities-and-bijections-the-theorems-worth-knowing) has
the crossing/nesting story in full, including the dual [`non_crossing_matchings`](/explore/collection/non_crossing_matchings) / [`non_nesting_matchings`](/explore/collection/non_nesting_matchings) pair.

## Elsewhere

- **[Explorer](/explore/collection/set_partitions)** — browse every partition of a given $n$ interactively.
- **[Learn: Subsets & partitions](/learn/guides/subsets-and-partitions)** — the beginner-level introduction this page
  goes deeper than.
- **[Wikipedia: Partition of a set](https://en.wikipedia.org/wiki/Partition_of_a_set)** and **[mathlib4:
  `Finpartition`](https://leanprover-community.github.io/mathlib4_docs/Mathlib/Order/Partition/Finpartition.html)**
  — the reference implementations this collection is checked against.
