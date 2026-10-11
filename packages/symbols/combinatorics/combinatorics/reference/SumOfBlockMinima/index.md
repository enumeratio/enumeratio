---
name: SumOfBlockMinima
domain: Set partition statistics
signature: SumOfBlockMinima(partition)
summary: The sum of the smallest elements of the blocks.
catalog:
  - system: findstat
    identity: St000230
    url: https://www.findstat.org/St000230
    on: SetPartition
statOn:
  - SetPartition
signatures:
  - call: SumOfBlockMinima(partition)
    description: The sum of the smallest elements of the blocks.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
