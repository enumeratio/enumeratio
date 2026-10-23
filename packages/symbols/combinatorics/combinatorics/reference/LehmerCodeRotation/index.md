---
name: LehmerCodeRotation
domain: Combinatorial maps
signature: LehmerCodeRotation(Permutation)
summary: The permutation whose Lehmer code is this one's with every entry one larger, cyclically.
catalog:
  - system: findstat
    identity: Mp00149
    url: https://www.findstat.org/Mp00149
    on: Permutation
mapOn:
  - Permutation
laws:
  - bijection
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: LehmerCodeRotation(Permutation)
    description: The permutation whose Lehmer code is this one's with every entry one larger, cyclically.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00149. Entry i wraps from n - i back to 0.
