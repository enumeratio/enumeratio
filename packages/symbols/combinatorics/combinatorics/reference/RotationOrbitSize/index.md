---
name: RotationOrbitSize
domain: Set partition statistics
signature: RotationOrbitSize(partition)
summary: The number of distinct partitions rotation i -> i + 1 (mod n) makes of this one.
catalog:
  - system: findstat
    identity: St000163
    url: https://www.findstat.org/St000163
    on: SetPartition
  - system: findstat
    identity: St000820
    url: https://www.findstat.org/St000820
    on: Composition
statOn:
  - Composition
  - SetPartition
signatures:
  - call: RotationOrbitSize(partition)
    description: The number of distinct partitions rotation i -> i + 1 (mod n) makes of this one.
    library: enumeratio-combinatorics
    type: (composition | set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
