---
name: BlocksSizeTwo
domain: Set partition statistics
signature: BlocksSizeTwo(partition)
summary: Blocks containing exactly two elements.
statOn:
  - SetPartition
signatures:
  - call: BlocksSizeTwo(partition)
    description: Blocks containing exactly two elements.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
