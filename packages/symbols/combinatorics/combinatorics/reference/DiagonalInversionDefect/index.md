---
name: DiagonalInversionDefect
domain: Partition statistics
signature: DiagonalInversionDefect(partition)
summary: Cells whose arm minus leg is neither 0 nor 1.
catalog:
  - system: findstat
    identity: St000377
    url: https://www.findstat.org/St000377
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: DiagonalInversionDefect(partition)
    description: Cells whose arm minus leg is neither 0 nor 1.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
