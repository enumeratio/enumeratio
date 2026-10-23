---
name: CactusEvacuation
domain: Combinatorial maps
signature: CactusEvacuation(Permutation)
summary: The permutation with the same insertion tableau and the evacuation of the recording tableau.
catalog:
  - system: findstat
    identity: Mp00126
    url: https://www.findstat.org/Mp00126
    on: Permutation
mapOn:
  - Permutation
laws:
  - involution
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: CactusEvacuation(Permutation)
    description: The permutation with the same insertion tableau and the evacuation of the recording tableau.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00126, an involution: RSK, evacuate the recording tableau, RSK backwards.
