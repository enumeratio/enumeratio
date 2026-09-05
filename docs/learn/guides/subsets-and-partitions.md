# Subsets & partitions

Take the 4 objects $\{1,2,3,4\}$. There isn't one "right" way to build a collection out of them — slice by *how
many* you keep, or by *how you group* what's left over, and each choice is its own collection, with its own
count. This chapter walks through four slicings of the same handful of objects.

## Subsets — keep any number

A **subset** of $[n]$ just says, for each of the $n$ elements, in or out. $[3] = \{1,2,3\}$ has all eight:

<p>
<enumeratio-notation collection="subsets" n="3" rank="0"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="1"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="2"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="3"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="4"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="5"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="6"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="subsets" n="3" rank="7"></enumeratio-notation>
</p>

Each in/out choice is independent, so $|2^{[n]}| = 2^n$ — 8 here, and its figure draws exactly that: one cell
per element, filled where it's a member —

<enumeratio-figure collection="subsets" n="4" rank="6"></enumeratio-figure>

## k-Subsets — fix the size

**[`k_subsets`](/explore/collection/k_subsets)** is the *same* objects, but graded by size too: instead of one
fiber holding all $2^n$ subsets, there's a separate fiber for each $k$. `k_subsets(4, 2)` holds only the 2-element
subsets of $[4]$ — $\binom{4}{2} = 6$ of them. This page's live widgets only bind a collection's first size axis,
so leaving `k` unbound streams every fiber smallest-first — $k{=}0$ (1 subset), then $k{=}1$ (4), so the six
2-element subsets land at ranks 5 through 10:

<p>
<enumeratio-notation collection="k_subsets" n="4" rank="5"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="k_subsets" n="4" rank="6"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="k_subsets" n="4" rank="7"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="k_subsets" n="4" rank="8"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="k_subsets" n="4" rank="9"></enumeratio-notation> &nbsp;
<enumeratio-notation collection="k_subsets" n="4" rank="10"></enumeratio-notation>
</p>

<enumeratio-assert-summary label="subsets & partitions checks"></enumeratio-assert-summary>

<p>
<enumeratio-assert expect="1100" reveal="always" label="k_subsets(4) rank 5 — the first 2-subset, {1,2}">
  <enumeratio-notation collection="k_subsets" n="4" rank="5"></enumeratio-notation>
</enumeratio-assert>
</p>

For the fixed-$(n,k)$ view — just the six, cleanly — open [`k_subsets` in the
explorer](/explore/collection/k_subsets) and set both parameters there.

[`subsets`](/explore/collection/subsets) and [`k_subsets`](/explore/collection/k_subsets) share a carrier (a `finset`), so [`k_subsets`](/explore/collection/k_subsets) draws with the exact same figure — group
all the size-2 fibers of `k_subsets(4)` back together and you get `subsets(4)` right back. This is the pattern
worth internalizing: **the same objects, cut along a different axis, is a different collection** — not a filter
bolted onto one collection, a sibling with its own cardinality and its own ranking. The [atlas's grading-grids
table](/explore/#grading-grids-→-order-isomorphic-siblings) lists the rest of the family — ordered set
partitions and integer compositions follow the identical pattern.

## Set partitions — group, don't choose

A **set partition** of $[n]$ splits every element into exactly one block — nothing left out, no picking a
subset. $[4]$ splits [Bell(4) = 15](/explore/collection/set_partitions) ways; here's one with two blocks:

<enumeratio-figure collection="set_partitions" n="4" rank="3"></enumeratio-figure>

Fix the block *count* and you get the sibling
**[`set_partitions_into_k_blocks`](/explore/collection/set_partitions_into_k_blocks)** — exactly the same
grading move as [`subsets`](/explore/collection/subsets) → [`k_subsets`](/explore/collection/k_subsets). Counted by $k$, the row is the **Stirling numbers of the second kind**,
and they sum back to Bell(4) $=15$: $1 + 7 + 6 + 1 = 15$. For the full standard-reference treatment — notation,
the refinement lattice as a live Hasse diagram, the non-crossing restriction — see
**[Set partitions](/learn/explorations/set-partitions)**.

## Integer partitions — group the *count*, not the objects

One step more abstract: forget *which* elements are in a block and keep only the block *sizes*. That's an
**integer partition** of $n$ — an unordered sum of positive parts. $6 = 4+2$ is one of
[$p(6)=11$](/explore/collection/integer_partitions):

<p>
<enumeratio-notation collection="integer_partitions" n="6" rank="2"></enumeratio-notation>
&nbsp;→&nbsp;
<enumeratio-figure collection="integer_partitions" n="6" rank="2"></enumeratio-figure>
</p>

That staircase is a **Ferrers diagram** — one row of boxes per part, longest on top. Fixing the number of parts
gives the sibling **[`k_part_partitions`](/explore/collection/k_part_partitions)**, same move again.

## The pattern, named

Four collections, one recurring move: **ungraded-by-size** ([`subsets`](/explore/collection/subsets), [`set_partitions`](/explore/collection/set_partitions), [`integer_partitions`](/explore/collection/integer_partitions) —
one fiber holds every size at once) versus **graded-by-size** ([`k_subsets`](/explore/collection/k_subsets), [`set_partitions_into_k_blocks`](/explore/collection/set_partitions_into_k_blocks),
[`k_part_partitions`](/explore/collection/k_part_partitions) — a separate, rankable fiber per size). Neither is more "correct" — they're
order-isomorphic siblings answering different questions, and the library keeps both because a query sometimes
wants "all of them" and sometimes wants "exactly this many."

Next: **[Words & compositions](/learn/guides/words-and-compositions)**, where the same objects show up encoded as a
*string* — and encoding turns out to be worth taking seriously as its own idea.
