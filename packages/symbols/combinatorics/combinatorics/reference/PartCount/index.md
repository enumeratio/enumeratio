---
name: PartCount
domain: Partition statistics
signature: PartCount(partition)
summary: The number of parts.
catalog:
  - system: findstat
    identity: St000010
    url: https://www.findstat.org/St000010
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PartCount(partition)
    description: The number of parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
