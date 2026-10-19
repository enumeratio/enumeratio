---
name: RightCloserBigger
domain: Set partition statistics
signature: RightCloserBigger(partition)
summary: Pairs of a closer j and a smaller element i of an earlier block.
catalog:
  - system: findstat
    identity: St000499
    url: https://www.findstat.org/St000499
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: RightCloserBigger(partition)
    description: Pairs of a closer j and a smaller element i of an earlier block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's rcb (right, closer, bigger).
