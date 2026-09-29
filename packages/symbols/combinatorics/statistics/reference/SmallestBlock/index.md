---
name: SmallestBlock
domain: Set partition statistics
signature: SmallestBlock(partition)
summary: The size of the smallest block.
catalog:
  - system: findstat
    identity: St001075
    url: https://www.findstat.org/St001075
    on: SetPartition
statOn:
  - SetComposition
  - SetPartition
signatures:
  - call: SmallestBlock(partition)
    description: The size of the smallest block.
    library: enumeratio-statistics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
