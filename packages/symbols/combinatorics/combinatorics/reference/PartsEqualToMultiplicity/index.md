---
name: PartsEqualToMultiplicity
domain: Partition statistics
signature: PartsEqualToMultiplicity(partition)
summary: Parts equal to their own multiplicity.
catalog:
  - system: findstat
    identity: St001939
    url: https://www.findstat.org/St001939
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PartsEqualToMultiplicity(partition)
    description: Parts equal to their own multiplicity.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
