---
name: DistinctMultiplicities
domain: Partition statistics
signature: DistinctMultiplicities(partition)
summary: How many different multiplicities the part sizes have.
catalog:
  - system: findstat
    identity: St000897
    url: https://www.findstat.org/St000897
    on: IntegerPartition
  - system: findstat
    identity: St000905
    url: https://www.findstat.org/St000905
    on: Composition
statOn:
  - Composition
  - IntegerPartition
signatures:
  - call: DistinctMultiplicities(partition)
    description: How many different multiplicities the part sizes have.
    library: enumeratio-combinatorics
    type: (composition | integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
