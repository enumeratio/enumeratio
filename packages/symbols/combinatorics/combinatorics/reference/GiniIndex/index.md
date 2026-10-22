---
name: GiniIndex
domain: Partition statistics
signature: GiniIndex(partition)
summary: The size plus 1 choose 2, less the sum over the columns of the column length plus 1 choose 2.
signatures:
  - call: GiniIndex(partition)
    description: The size plus 1 choose 2, less the sum over the columns of the column length plus 1 choose 2.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
