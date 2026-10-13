---
name: FlooredHalfMultiplicitySum
domain: Partition statistics
signature: FlooredHalfMultiplicitySum(partition)
summary: The sum, over part sizes, of half the multiplicity rounded down.
catalog:
  - system: findstat
    identity: St000150
    url: https://www.findstat.org/St000150
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: FlooredHalfMultiplicitySum(partition)
    description: The sum, over part sizes, of half the multiplicity rounded down.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
