---
name: BlockConcatenation
domain: Combinatorial maps
signature: BlockConcatenation(SetComposition)
summary: The permutation that lists the blocks in order, each sorted increasingly.
catalog:
  - system: findstat
    identity: Mp00286
    url: https://www.findstat.org/Mp00286
    on: SetComposition
mapOn:
  - SetComposition
laws:
  - surjection
  - graded:
      from: SetCompositions
      to: Permutations
    on: set_composition
signatures:
  - call: BlockConcatenation(SetComposition)
    description: The permutation that lists the blocks in order, each sorted increasingly.
    library: enumeratio-combinatorics
    type: (set_composition) -> permutation
---

- Takes a `SetComposition` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00286. Lossy: where one block ends and the next starts is forgotten.
