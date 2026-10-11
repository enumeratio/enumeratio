---
name: SumOfBlockMaxima
domain: Set partition statistics
signature: SumOfBlockMaxima(partition)
summary: The sum of the largest elements of the blocks.
signatures:
  - call: SumOfBlockMaxima(partition)
    description: The sum of the largest elements of the blocks.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
