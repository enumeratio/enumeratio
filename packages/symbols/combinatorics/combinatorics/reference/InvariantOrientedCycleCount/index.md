---
name: InvariantOrientedCycleCount
domain: Partition statistics
signature: InvariantOrientedCycleCount(partition)
summary: "The cyclic permutations that a permutation of this cycle type fixes under conjugation: none unless the parts are all equal to some d, in which case totient(d) d^(m-1) (m-1)! for m parts."
catalog:
  - system: findstat
    identity: St000510
    url: https://www.findstat.org/St000510
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: InvariantOrientedCycleCount(partition)
    description: "The cyclic permutations that a permutation of this cycle type fixes under conjugation: none unless the parts are all equal to some d, in which case totient(d) d^(m-1) (m-1)! for m parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
