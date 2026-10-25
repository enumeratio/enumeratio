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
  - system: findstat
    identity: Mp00327
    url: https://www.findstat.org/Mp00327
    on: DyckPath
mapOn:
  - DyckPath
  - Permutation
laws:
  - bijection
  - inverse: KrewerasComplement
    on: permutation
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
  - graded:
      from: DyckPaths
      to: DyckPaths
    on: dyck_path
signatures:
  - call: InverseKrewerasComplement(Permutation)
    description: "cπ⁻¹ with the long cycle c = (1 2 ... n), FindStat's order: position i holds π⁻¹(c(i))."
    library: enumeratio-combinatorics
    type: ((dyck_path) -> dyck_path) & ((permutation) -> permutation)
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00089; the inverse of KrewerasComplement.
- Also takes a `DyckPath`, returning a `DyckPath`: The inverse Kreweras complement of the path read as a noncrossing partition: the blocks are the downs after each up step.
- FindStat's Mp00327. A bijection of each size; Mp00089 is the same map on noncrossing permutations.
