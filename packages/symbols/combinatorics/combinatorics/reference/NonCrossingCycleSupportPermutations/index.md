---
name: NonCrossingCycleSupportPermutations
domain: Collections
signature: NonCrossingCycleSupportPermutations(n)
summary: The permutations of $\{1, …, n\}$ whose cycles, read as a set partition of $\{1, …, n\}$, form a non-crossing partition — cycles may hold their elements in any cyclic order — as a lazy indexed family.
signatures:
  - call: NonCrossingCycleSupportPermutations(n)
    library: enumeratio-combinatorics
    description: the permutations of $\{1, …, n\}$ whose cycles are a non-crossing set partition.
    type: (integer<0..>) -> indexed_collection<permutation>
enumerate:
  expr: NonCrossingCycleSupportPermutations(4)
  columns: CycleCount, FixedPoints
  glyph: permutation
seeAlso:
  - NonCrossingPermutations
  - CatalanNumber
  - Count
  - At
grades:
  - name: size
    role: axis
carrier: Permutation
---

- A lazy indexed collection; the count follows a verified recurrence on the block containing $1$ — $1, 2, 6, 23, 105, …$ — with no OEIS match confirmed for this reading, so none is cited.
- Cyclic order within a block is unconstrained. Requiring each cycle's elements to increase (the interval $[e, (1\,2\,…\,n)]$ in absolute order) gives the standard noncrossing permutations, [[NonCrossingPermutations]], counted by the Catalan numbers $1, 2, 5, 14, …$
- Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those whose cycles are non-crossing.
