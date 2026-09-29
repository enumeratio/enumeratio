---
name: PermutationsAsCycles
domain: Collections
signature: PermutationsAsCycles(n)
summary: Every permutation of $\{1, …, n\}$ in cycle notation, fixed points kept, listed by cycle type.
signatures:
  - call: PermutationsAsCycles(n)
    description: every permutation of $\{1, …, n\}$ as a cycle decomposition, by cycle type
    library: enumeratio-combinatorics
    type: (integer<0..>) -> indexed_collection<cycle_decomposition>
seeAlso:
  - SymmetricGroup
  - CycleDecomposition
  - IntegerPartitions
references:
  - system: oeis
    identity: A000142
grades:
  - name: n
    role: axis
carrier: CycleDecomposition
---

- The same permutations as [[SymmetricGroup]], in another order: by cycle type, in [[IntegerPartitions]]' order (the $n$-cycles first, the identity last), then by the canonical cycle form, lexicographically. The order is our choice, not something cycle notation implies.
- Each element is a [[CycleDecomposition]], so every permutation statistic answers on it.
