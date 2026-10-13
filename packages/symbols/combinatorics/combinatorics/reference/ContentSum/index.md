---
name: ContentSum
domain: Partition statistics
signature: ContentSum(partition)
summary: The sum of the contents j - i of the cells.
catalog:
  - system: findstat
    identity: St000509
    url: https://www.findstat.org/St000509
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: ContentSum(partition)
    description: The sum of the contents j - i of the cells.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
