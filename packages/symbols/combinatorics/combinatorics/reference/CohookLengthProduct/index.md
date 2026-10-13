---
name: CohookLengthProduct
domain: Partition statistics
signature: CohookLengthProduct(partition)
summary: The product of the cohook lengths i + j - 1 of the cells.
catalog:
  - system: findstat
    identity: St001378
    url: https://www.findstat.org/St001378
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: CohookLengthProduct(partition)
    description: The product of the cohook lengths i + j - 1 of the cells.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
