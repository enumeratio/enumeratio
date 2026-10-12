---
name: MaximalBlockDifference
domain: Set partition statistics
signature: MaximalBlockDifference(partition)
summary: The largest difference between two elements of one block.
catalog:
  - system: findstat
    identity: St000503
    url: https://www.findstat.org/St000503
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: MaximalBlockDifference(partition)
    description: The largest difference between two elements of one block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
