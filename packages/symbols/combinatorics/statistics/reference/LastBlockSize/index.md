---
name: LastBlockSize
domain: Set partition statistics
signature: LastBlockSize(partition)
summary: The size of the final block.
statOn:
  - SetComposition
  - SetPartition
signatures:
  - call: LastBlockSize(partition)
    description: The size of the final block.
    library: enumeratio-statistics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
