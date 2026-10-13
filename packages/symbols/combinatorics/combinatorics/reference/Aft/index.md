---
name: Aft
domain: Partition statistics
signature: Aft(partition)
summary: The size minus the larger of the largest part and the number of parts.
catalog:
  - system: findstat
    identity: St001214
    url: https://www.findstat.org/St001214
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: Aft(partition)
    description: The size minus the larger of the largest part and the number of parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
