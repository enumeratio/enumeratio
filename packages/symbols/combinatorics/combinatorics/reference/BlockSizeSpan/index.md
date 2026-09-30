---
name: BlockSizeSpan
domain: Set partition statistics
signature: BlockSizeSpan(partition)
summary: Largest block size minus smallest.
statOn:
  - SetPartition
signatures:
  - call: BlockSizeSpan(partition)
    description: Largest block size minus smallest.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
