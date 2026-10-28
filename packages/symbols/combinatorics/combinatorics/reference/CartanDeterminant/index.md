---
name: CartanDeterminant
domain: Partition statistics
signature: CartanDeterminant(partition)
summary: "The determinant of the matrix of the minimums of the distinct parts: the least distinct part times the gaps between consecutive distinct parts."
catalog:
  - system: findstat
    identity: St001571
    url: https://www.findstat.org/St001571
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CartanDeterminant(partition)
    description: "The determinant of the matrix of the minimums of the distinct parts: the least distinct part times the gaps between consecutive distinct parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
