---
name: MajorCodeToLehmerCode
domain: Combinatorial maps
signature: MajorCodeToLehmerCode(Permutation)
summary: The permutation whose Lehmer code is this permutation's major code.
catalog:
  - system: findstat
    identity: Mp00073
    url: https://www.findstat.org/Mp00073
    on: Permutation
mapOn:
  - Permutation
laws:
  - bijection
  - inverse: LehmerCodeToMajorCode
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: MajorCodeToLehmerCode(Permutation)
    description: The permutation whose Lehmer code is this permutation's major code.
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00073. It carries the major index to the inversion count; the inverse is LehmerCodeToMajorCode.
