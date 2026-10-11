---
name: FirstBlockCardinality
domain: Set partition statistics
signature: FirstBlockCardinality(partition)
summary: The size of the block containing 1.
catalog:
  - system: findstat
    identity: St000504
    url: https://www.findstat.org/St000504
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: FirstBlockCardinality(partition)
    description: The size of the block containing 1.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
