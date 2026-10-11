---
name: DimensionIndex
domain: Set partition statistics
signature: DimensionIndex(partition)
summary: The sum over blocks of largest minus smallest element, plus one.
signatures:
  - call: DimensionIndex(partition)
    description: The sum over blocks of largest minus smallest element, plus one.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
