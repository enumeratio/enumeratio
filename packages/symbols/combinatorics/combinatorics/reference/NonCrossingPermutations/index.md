---
name: NonCrossingPermutations
domain: Collections
signature: NonCrossingPermutations(n)
summary: The noncrossing permutations of $\{1, …, n\}$ (Biane, Kreweras) — those below the long cycle $(1\,2\,…\,n)$ in absolute order — as a lazy indexed family.
signatures:
  - call: NonCrossingPermutations(n)
    library: enumeratio-combinatorics
    description: the permutations $\pi$ with $\ell_T(\pi) + \ell_T(\pi^{-1} c) = n - 1$ for $c = (1\,2\,…\,n)$; their cycles are the blocks of a noncrossing partition, each cycle increasing.
    type: (integer<0..>) -> indexed_collection<permutation>
enumerate:
  expr: NonCrossingPermutations(4)
  columns: CycleCount, FixedPoints
  glyph: permutation
seeAlso:
  - NonCrossingCycleSupportPermutations
  - CatalanNumber
  - Count
  - At
catalog:
  - system: oeis
    identity: A000108
    url: https://oeis.org/A000108
    note: the Catalan numbers; the interval $[e, c]$ is isomorphic to the lattice of noncrossing partitions
  - system: sage
    identity: CoxeterGroup(['A', n-1]).noncrossing_partition_lattice()
    url: https://doc.sagemath.org/html/en/reference/combinat/sage/combinat/posets/lattices.html
    note: verified n=2..6 (2, 5, 14, 42, 132)
grades:
  - name: size
    role: axis
carrier: Permutation
---

- A lazy indexed collection; the count is the Catalan number $C_n$ — $1, 1, 2, 5, 14, 42, …$, A000108.
- $\ell_T$ is the reflection length, $n$ minus the number of cycles. Equivalently the cycles of $\pi$ are the blocks of a noncrossing partition of $\{1, …, n\}$, each block traversed in increasing cyclic order.
- Each element is the one-line word; $At$ enumerates all $n!$ permutations in lexicographic order and indexes into those below the long cycle, so it is practical only for small $n$; the count is exact for every $n$.
- Relaxing the cycle order — blocks noncrossing, each cycle in any cyclic order — is [[NonCrossingCycleSupportPermutations]] ($1, 2, 6, 23, 105, …$).
