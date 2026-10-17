---
name: LeftCloserBigger
domain: Set partition statistics
signature: LeftCloserBigger(partition)
summary: Pairs of a closer j and a smaller element i of a later block.
catalog:
  - system: findstat
    identity: St000497
    url: https://www.findstat.org/St000497
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: LeftCloserBigger(partition)
    description: Pairs of a closer j and a smaller element i of a later block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's lcb (left, closer, bigger).
