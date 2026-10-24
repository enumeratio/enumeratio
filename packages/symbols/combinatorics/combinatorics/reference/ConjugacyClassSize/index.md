---
name: ConjugacyClassSize
domain: Permutation statistics
signature: ConjugacyClassSize(p)
summary: "The number of permutations of the same cycle type: n! over the product of the cycle sizes and the factorials of the multiplicities."
catalog:
  - system: findstat
    identity: St000690
    url: https://www.findstat.org/St000690
    on: Permutation
  - system: findstat
    identity: St000182
    url: https://www.findstat.org/St000182
    on: IntegerPartition
statOn:
  - IntegerPartition
  - Permutation
signatures:
  - call: ConjugacyClassSize(p)
    description: "The number of permutations of the same cycle type: n! over the product of the cycle sizes and the factorials of the multiplicities."
    library: enumeratio-combinatorics
    type: (integer_partition | permutation) -> number
bindings:
  - origin: mapped
    form: sage
    template: enumeratio_stat("Permutation", $1, "ConjugacyClassSize")
    arity: 1
    checked:
      version: "10.9"
      on: 2026-10-16
---

- Defined over `Permutation` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `Permutation` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- On a partition, the parts are the cycle lengths of a permutation, and the size is n! over `CentralizerSize`.
