---
name: Antisingletons
domain: Set partition statistics
signature: Antisingletons(partition)
summary: Elements i with i + 1 in the same block, counting n + 1 as 1.
signatures:
  - call: Antisingletons(partition)
    description: Elements i with i + 1 in the same block, counting n + 1 as 1.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
