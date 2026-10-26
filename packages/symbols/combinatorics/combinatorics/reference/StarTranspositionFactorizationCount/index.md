---
name: StarTranspositionFactorizationCount
domain: Partition statistics
signature: StarTranspositionFactorizationCount(partition)
summary: "Minimal transitive factorizations of a permutation of this cycle type into star transpositions: the product of the parts times (n + 1) ... (n + length - 2)."
catalog:
  - system: findstat
    identity: St001936
    url: https://www.findstat.org/St001936
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: StarTranspositionFactorizationCount(partition)
    description: "The minimal transitive factorizations of a permutation of this cycle type into star transpositions: the product of the parts times (n + 1)...(n + length - 2)."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
