---
name: LeftOpenerSmaller
domain: Set partition statistics
signature: LeftOpenerSmaller(partition)
summary: Pairs of an opener j and a larger element i of a later block.
catalog:
  - system: findstat
    identity: St000493
    url: https://www.findstat.org/St000493
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: LeftOpenerSmaller(partition)
    description: Pairs of an opener j and a larger element i of a later block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's los (left, opener, smaller), the dual major index.
