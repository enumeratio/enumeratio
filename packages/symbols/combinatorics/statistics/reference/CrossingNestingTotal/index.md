---
name: CrossingNestingTotal
domain: Set partition statistics
signature: CrossingNestingTotal(partition)
summary: Crossings plus nestings.
statOn:
  - SetPartition
signatures:
  - call: CrossingNestingTotal(partition)
    description: Crossings plus nestings.
    library: enumeratio-statistics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
