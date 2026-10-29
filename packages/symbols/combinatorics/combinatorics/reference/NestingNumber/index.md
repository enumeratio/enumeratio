---
name: NestingNumber
domain: Set partition statistics
signature: NestingNumber(partition)
summary: The largest number of arcs that mutually nest.
catalog:
  - system: findstat
    identity: St000254
    url: https://www.findstat.org/St000254
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: NestingNumber(partition)
    description: The largest number of arcs that mutually nest.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's St000254.
