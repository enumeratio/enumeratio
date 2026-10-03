---
name: Cycles
domain: Permutations
signature: Cycles(decomposition)
summary: A permutation in disjoint-cycle notation, written from a CycleDecomposition, which drops its fixed points.
signatures:
  - call: Cycles(decomposition)
    description: the cycles of a CycleDecomposition, fixed points dropped
    library: enumeratio-combinatorics
    type: ((list<list<integer>>) -> expression<Cycles>) & ((cycle_decomposition) -> expression<Cycles>)
    overrides: enumeratio-groupalgebra
    types:
      - cycle_decomposition
seeAlso:
  - CycleDecomposition
---

- The conversion from a [[CycleDecomposition]], which keeps its fixed points: the way back needs the size, `CycleDecomposition(Cycles(...), n)`.
- The rest of `Cycles` is groupalgebra's.
