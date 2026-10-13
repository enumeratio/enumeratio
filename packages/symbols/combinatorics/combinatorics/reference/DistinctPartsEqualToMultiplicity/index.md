---
name: DistinctPartsEqualToMultiplicity
domain: Partition statistics
signature: DistinctPartsEqualToMultiplicity(partition)
summary: Distinct part sizes equal to their multiplicity.
catalog:
  - system: findstat
    identity: St001940
    url: https://www.findstat.org/St001940
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: DistinctPartsEqualToMultiplicity(partition)
    description: Distinct part sizes equal to their multiplicity.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
