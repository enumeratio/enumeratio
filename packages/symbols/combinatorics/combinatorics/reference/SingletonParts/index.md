---
name: SingletonParts
domain: Partition statistics
signature: SingletonParts(partition)
summary: Parts that occur exactly once.
catalog:
  - system: findstat
    identity: St001484
    url: https://www.findstat.org/St001484
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SingletonParts(partition)
    description: Parts that occur exactly once.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
