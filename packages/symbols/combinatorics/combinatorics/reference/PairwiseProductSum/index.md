---
name: PairwiseProductSum
domain: Partition statistics
signature: PairwiseProductSum(partition)
summary: The sum of the products of all pairs of parts.
catalog:
  - system: findstat
    identity: St000567
    url: https://www.findstat.org/St000567
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PairwiseProductSum(partition)
    description: The sum of the products of all pairs of parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
