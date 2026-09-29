---
name: PartsEqualOne
domain: Partition statistics
signature: PartsEqualOne(partition)
summary: Parts equal to 1.
statOn:
  - Composition
  - IntegerPartition
signatures:
  - call: PartsEqualOne(partition)
    description: Parts equal to 1.
    library: enumeratio-statistics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
