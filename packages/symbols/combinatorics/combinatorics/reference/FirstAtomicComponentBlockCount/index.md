---
name: FirstAtomicComponentBlockCount
domain: Set partition statistics
signature: FirstAtomicComponentBlockCount(partition)
summary: The least l for which the first l blocks hold exactly 1 .. m.
catalog:
  - system: findstat
    identity: St000695
    url: https://www.findstat.org/St000695
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: FirstAtomicComponentBlockCount(partition)
    description: The least l for which the first l blocks hold exactly 1 .. m.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
