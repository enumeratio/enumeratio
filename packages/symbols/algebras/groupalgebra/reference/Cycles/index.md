---
name: Cycles
domain: Permutations
signature: Cycles({{i1, i2, ...}, ...})
summary: 'A permutation written in disjoint-cycle notation: $(i_1\,i_2\,\dots\,i_k)$ sends $i_1 \to i_2 \to \dots \to i_k \to i_1$ and fixes everything else. A carrier, like [[PermutationGroup]] — it holds the cycles rather than computing anything from them.'
signatures:
  - call: Cycles({{i1, ..., ik}, ...})
    description: the permutation that cycles each listed tuple and fixes every other point
    library: enumeratio-groupalgebra
    type: (list<list<integer>>) -> expression<Cycles>
  - call: Cycles({{i1, i2, ...}, ...})
    description: 'A permutation written in disjoint-cycle notation: $(i_1\,i_2\,\dots\,i_k)$ sends $i_1 \to i_2 \to \dots \to i_k \to i_1$ and fixes everything else. A carrier, like [[PermutationGroup]] — it holds the cycles rather than computing anything from them.'
    library: enumeratio-combinatorics
    type: ((list<list<integer>>) -> expression<Cycles>) & ((cycle_decomposition) -> expression<Cycles>)
    overrides: enumeratio-groupalgebra
seeAlso:
  - PermutationCycles
  - Permute
  - PermutationGroup
  - InversePermutation
references:
  - system: wikipedia
    identity: Cyclic permutation
  - system: mathworld
    identity: PermutationCycle
names:
  wolframIdentity: true
mapOn:
  - Permutation
catalog:
  - system: findstat
    identity: St000031
    url: https://www.findstat.org/St000031
    on: Permutation
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_cycles($1)
    arity: 1
---

- Fixed points (singleton cycles) are dropped on construction — $\mathrm{Cycles}(\{\{1\},\{2,3\}\})$ and $\mathrm{Cycles}(\{\{2,3\}\})$ are the same value
- Otherwise each cycle is rotated to start at its smallest point and the cycles are ordered by that first point, as Wolfram does — $\mathrm{Cycles}(\{\{3,2,5,1\},\{7,4\}\})$ is $\mathrm{Cycles}(\{\{1,3,2,5\},\{4,7\}\})$
- [[PermutationCycles]] builds one from a one-line word; [[Permute]] applies one to a list; [[InversePermutation]] reverses one
- Written from a [[CycleDecomposition]], it drops that value's fixed points. `CycleDecomposition(cycles, n)` is the way back, given the size
