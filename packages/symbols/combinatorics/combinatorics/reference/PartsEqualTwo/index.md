---
name: PartsEqualTwo
domain: Partition statistics
signature: PartsEqualTwo(partition)
summary: Parts equal to 2.
signatures:
  - call: PartsEqualTwo(partition)
    description: Parts equal to 2.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St001657
    url: https://www.findstat.org/St001657
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
