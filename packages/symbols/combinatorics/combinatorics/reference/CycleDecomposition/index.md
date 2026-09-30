---
name: CycleDecomposition
domain: Collections
signature: CycleDecomposition(cycles)
catalogCarrier: true
summary: "The singular-inhabitant constructor for a permutation in cycle notation with its fixed points kept: each cycle from its least point, cycles in order of those points."
signatures:
  - call: CycleDecomposition(cycles)
    description: "The singular-inhabitant constructor for a permutation in cycle notation with its fixed points kept: each cycle from its least point, cycles in order of those points."
    library: enumeratio-combinatorics
    type: ((list<list<integer>>) -> cycle_decomposition) & ((permutation) -> cycle_decomposition)
seeAlso:
  - PermutationsAsCycles
  - Cycles
  - PermutationCycles
references:
  - system: wikipedia
    identity: Permutation#Cycle notation
laws:
  - inverse: Permutation
---

- Keeping the fixed points is what makes it a permutation of a definite size, so it converts back: `Permutation(CycleDecomposition(p))` is `p`, and every permutation statistic answers on a decomposition. Wolfram's [[Cycles]] drops them, so it can't say how many points there are.
- `CycleDecomposition(Permutation([…]))` converts; `CycleDecomposition` of anything else holds it as given.
