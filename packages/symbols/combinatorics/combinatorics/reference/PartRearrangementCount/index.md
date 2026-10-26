---
name: PartRearrangementCount
domain: Partition statistics
signature: PartRearrangementCount(partition)
summary: "Distinct rearrangements of the parts, the compositions that sort to this partition: the number of parts factorial over the factorials of the multiplicities."
catalog:
  - system: findstat
    identity: St000278
    url: https://www.findstat.org/St000278
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PartRearrangementCount(partition)
    description: "The number of distinct rearrangements of the parts, the compositions that sort to this partition: the number of parts factorial over the product of the factorials of the multiplicities."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
