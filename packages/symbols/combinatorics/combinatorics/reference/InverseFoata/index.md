---
name: InverseFoata
domain: Combinatorial maps
signature: InverseFoata(Permutation)
summary: The permutation whose cycles are the stretches of the word between successive left-to-right maxima, each read as a cycle.
catalog:
  - system: findstat
    identity: Mp00086
    url: https://www.findstat.org/Mp00086
    on: Permutation
mapOn:
  - Permutation
laws:
  - bijection
  - inverse: Foata
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: InverseFoata(Permutation)
    description: The permutation whose cycles are the stretches of the word between successive left-to-right maxima, each read as a cycle.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00086, the inverse of Foata: a word's left-to-right maxima open its cycles.
