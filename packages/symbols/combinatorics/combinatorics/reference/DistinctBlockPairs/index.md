---
name: DistinctBlockPairs
domain: Set partition statistics
signature: DistinctBlockPairs(partition)
summary: Pairs of elements in different blocks.
catalog:
  - system: findstat
    identity: St000564
    url: https://www.findstat.org/St000564
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: DistinctBlockPairs(partition)
    description: Pairs of elements in different blocks.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
