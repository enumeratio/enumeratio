---
name: RightOpenerSmaller
domain: Set partition statistics
signature: RightOpenerSmaller(partition)
summary: Pairs of an opener j and a larger element i of an earlier block.
catalog:
  - system: findstat
    identity: St000491
    url: https://www.findstat.org/St000491
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: RightOpenerSmaller(partition)
    description: Pairs of an opener j and a larger element i of an earlier block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's ros (right, opener, smaller): an inversion of the set partition in Steingrímsson's sense.
