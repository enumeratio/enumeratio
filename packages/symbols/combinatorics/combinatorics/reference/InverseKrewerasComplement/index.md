---
name: InverseKrewerasComplement
domain: Combinatorial maps
signature: InverseKrewerasComplement(Permutation)
summary: "cπ⁻¹ with the long cycle c = (1 2 ... n), FindStat's order: position i holds π⁻¹(c(i))."
catalog:
  - system: findstat
    identity: Mp00089
    url: https://www.findstat.org/Mp00089
    on: Permutation
mapOn:
  - Permutation
laws:
  - bijection
  - inverse: KrewerasComplement
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
signatures:
  - call: InverseKrewerasComplement(Permutation)
    description: "cπ⁻¹ with the long cycle c = (1 2 ... n), FindStat's order: position i holds π⁻¹(c(i))."
    library: enumeratio-combinatorics
    type: (permutation) -> permutation
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00089; the inverse of KrewerasComplement.
