---
name: SetPartitionRank
domain: Set partition statistics
signature: SetPartitionRank(partition)
summary: The number of elements minus the number of blocks.
catalog:
  - system: findstat
    identity: St000211
    url: https://www.findstat.org/St000211
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: SetPartitionRank(partition)
    description: The number of elements minus the number of blocks.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
