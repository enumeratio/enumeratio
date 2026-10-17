---
name: FirstBlockSecondElementOrSmallestCloser
domain: Set partition statistics
signature: FirstBlockSecondElementOrSmallestCloser(partition)
summary: The smaller of the second element of the block holding 1 and the smallest closer; 1 when {1} is a block.
catalog:
  - system: findstat
    identity: St001784
    url: https://www.findstat.org/St001784
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: FirstBlockSecondElementOrSmallestCloser(partition)
    description: The smaller of the second element of the block holding 1 and the smallest closer; 1 when {1} is a block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A closer is the greatest element of a non-singleton block.
