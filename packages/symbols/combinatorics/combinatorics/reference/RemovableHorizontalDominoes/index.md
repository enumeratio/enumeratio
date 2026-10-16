---
name: RemovableHorizontalDominoes
domain: Partition statistics
signature: RemovableHorizontalDominoes(partition)
summary: "Parts from which 2 can be subtracted and leave a partition: rows ending in a removable horizontal domino."
catalog:
  - system: findstat
    identity: St000256
    url: https://www.findstat.org/St000256
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: RemovableHorizontalDominoes(partition)
    description: "Parts from which 2 can be subtracted and leave a partition: rows ending in a removable horizontal domino."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
