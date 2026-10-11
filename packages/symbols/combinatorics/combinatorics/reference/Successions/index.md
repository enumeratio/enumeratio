---
name: Successions
domain: Set partition statistics
signature: Successions(partition)
summary: Elements i with i + 1 in the same block.
catalog:
  - system: findstat
    identity: St000502
    url: https://www.findstat.org/St000502
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: Successions(partition)
    description: Elements i with i + 1 in the same block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
