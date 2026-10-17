---
name: BlockMajorIndex
domain: Set partition statistics
signature: BlockMajorIndex(partition)
summary: The sum over blocks i of i times the elements of block i above the least element of block i + 1.
catalog:
  - system: findstat
    identity: St000565
    url: https://www.findstat.org/St000565
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: BlockMajorIndex(partition)
    description: The sum over blocks i of i times the elements of block i above the least element of block i + 1.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
