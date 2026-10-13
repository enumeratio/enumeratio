---
name: SmallestMissingPart
domain: Partition statistics
signature: SmallestMissingPart(partition)
summary: The smallest positive integer that is not a part.
catalog:
  - system: findstat
    identity: St000759
    url: https://www.findstat.org/St000759
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SmallestMissingPart(partition)
    description: The smallest positive integer that is not a part.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
