# Ranking and Unranking

There are 479 001 600 permutations of twelve things. You would not want the list. But
"how many" and "which one is the hundred-millionth" are both perfectly reasonable
questions, and neither needs the list to exist.

That is the whole idea here. A combinatorial family is not a sequence you generate and
hold — it is a **bijection with an interval of the integers**. Fix an order, and the
family becomes an indexed collection: _rank_ takes an object to its position, _unrank_
takes a position back to an object. Everything else follows.

`@enumeratio/collections` declares each family as a lazy indexed collection on
compute-engine, so its own `Count` and `At` answer by arithmetic rather than by
enumeration.

<Story title="Counted and indexed, not built">
<template #description>12! permutations, and the hundred-millionth of them. Neither call builds a list.</template>
<notatio-cell value="Count(SymmetricGroup(12))" />
<notatio-cell value="SymmetricGroup(12)[100000000]" />
<notatio-cell value="Subsets(20)[700000]" />
</Story>

`At` is **1-based**: `At(F, 1)` is the first object and `At(F, Count(F))` the last. An
index outside that range wraps, so a slider can run past the end without erroring.

## Count is the combinatorics you already know

Ask a family how big it is and the classical numbers fall out — not as a lookup table,
but because counting the family _is_ what those numbers do.

<Story title="The counting sequences, recovered">
<template #description>Dyck paths are Catalan, set partitions are Bell, k-subsets are binomial. Each pair is the same number arrived at from two directions.</template>
<notatio-cell value="Count(DyckPaths(4))" />
<notatio-cell value="CatalanNumber(4)" />
<notatio-cell value="Count(SetPartitions(4))" />
<notatio-cell value="BellNumber(4)" />
<notatio-cell value="Count(KSubsets(5, 3))" />
<notatio-cell value="Binomial(5, 3)" />
</Story>

This is a good way to check an implementation, and a better way to remember what a
counting sequence counts. If `Count(Derangements(5))` did not come back 44, one of the
two would be wrong.

<Story title="Two more, for the habit">
<notatio-cell value="Count(Derangements(5))" />
<notatio-cell value="Count(Involutions(5))" />
<notatio-cell value="Count(IntegerPartitions(6))" />
</Story>

## Walk a family with a slider

An index is a dial. Sweep it and you see the family in its order, one object at a time —
which is the fastest way to learn what the order _is_.

<Story
  title="The 56 three-subsets of an eight-set">
<template #description>
Press ▶ and watch the order: the last element climbs slowest. That is
<strong>colex</strong> — subsets are ordered by their largest element first.
</template>
<notatio-manipulate v-pre params="{ {r, 1}, 1, 56, 1}">
<notatio-figure kind="subset" value="At(KSubsets(8,3), _r)" n="8" />
</notatio-manipulate>
</Story>

The slider's value fills the `_r` wildcard, the expression is evaluated, and the glyph
draws whatever came back. Nothing about that is specific to subsets — point it at a
different family and the same rig walks that one.

<Story
  title="The same dial, three families">
<template #description>
24 permutations of four things against 14 Dyck paths of semilength four — so the paths
wrap around while the permutations are still going. Wrapping is the point: an index is
taken modulo the count.
</template>
<notatio-manipulate v-pre params="{ {r, 1}, 1, 24, 1}">
<notatio-figure kind="permutation" value="At(SymmetricGroup(4), _r)" />
<notatio-figure kind="dyck" value="At(DyckPaths(4), _r)" />
</notatio-manipulate>
</Story>

## Statistics over the index

Once an object is addressable, a statistic of it is an ordinary function call. The
permutation statistics — inversions, descents, major index, cycles — compose with `At`
directly, which makes "what does this statistic look like across the family" a question
you can just ask.

<Story title="Statistics of the seventh permutation">
<template #description>The 7th permutation of four things is [2,1,3,4] — one inversion, one descent.</template>
<notatio-cell value="SymmetricGroup(4)[7]" />
<notatio-cell value="Inversions(SymmetricGroup(4)[7])" />
<notatio-cell value="Descents(SymmetricGroup(4)[7])" />
</Story>

## The order is part of the contract

A family and an order are not separable: change the order and `At` answers differently,
so the order has to be stated. `KSubsets` is **colexicographic** — the 4th 3-subset of
`{1..5}` is `{2,3,4}`, not `{1,2,5}`, because colex orders by the largest element first.

<Story title="Colex, from both ends">
<template #description>First and last. Colex is what makes the rank formula a sum of binomials — which is exactly the combinatorial number system.</template>
<notatio-cell value="KSubsets(5, 3)[1]" />
<notatio-cell value="KSubsets(5, 3)[10]" />
</Story>

## Where this goes next

Unranking is the same operation as writing a number in a numeral system whose places are
combinatorial rather than geometric — the factoradic digits of $n$ _are_ the Lehmer code
of the $n$-th permutation, and the combinatorial number system's digits _are_ the
$n$-th k-subset. [Numeral systems](/guide/numerals/) makes that identification properly.

Every family here is catalogued, with its order and its counting sequence, in the
[symbol reference](/reference/symbol/). The glyphs are
[`<notatio-figure>`](/reference/components/notatio-figure) and the slider is
[`<notatio-manipulate>`](/reference/components/notatio-manipulate).
