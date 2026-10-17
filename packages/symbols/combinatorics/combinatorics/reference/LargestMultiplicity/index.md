---
name: LargestMultiplicity
domain: Partition statistics
signature: LargestMultiplicity(partition)
summary: The largest multiplicity of a part.
catalog:
  - system: findstat
    identity: St001933
    url: https://www.findstat.org/St001933
    on: IntegerPartition
  - system: findstat
    identity: St000904
    url: https://www.findstat.org/St000904
    on: Composition
statOn:
  - Composition
  - IntegerPartition
signatures:
  - call: LargestMultiplicity(partition)
    description: The largest multiplicity of a part.
    library: enumeratio-combinatorics
    type: (composition | integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
