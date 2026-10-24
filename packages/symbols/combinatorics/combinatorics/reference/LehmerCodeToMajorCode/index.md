---
name: LehmerCodeToMajorCode
domain: Combinatorial maps
signature: LehmerCodeToMajorCode(Permutation)
summary: The permutation whose major code is this permutation's Lehmer code.
catalog:
  - system: findstat
    identity: Mp00062
    url: https://www.findstat.org/Mp00062
    on: Permutation
mapOn:
  - Permutation
laws:
  - bijection
  - inverse: MajorCodeToLehmerCode
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: LehmerCodeToMajorCode(Permutation)
    description: The permutation whose major code is this permutation's Lehmer code.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00062. It carries the inversion count to the major index; the inverse is MajorCodeToLehmerCode.
