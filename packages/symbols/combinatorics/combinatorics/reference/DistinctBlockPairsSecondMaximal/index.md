---
name: DistinctBlockPairsSecondMaximal
domain: Set partition statistics
signature: DistinctBlockPairsSecondMaximal(partition)
summary: Pairs a < b in different blocks with b the greatest element of its block.
catalog:
  - system: findstat
    identity: St000579
    url: https://www.findstat.org/St000579
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: DistinctBlockPairsSecondMaximal(partition)
    description: Pairs a < b in different blocks with b the greatest element of its block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
