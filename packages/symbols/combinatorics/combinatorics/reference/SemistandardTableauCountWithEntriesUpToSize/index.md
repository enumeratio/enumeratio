---
name: SemistandardTableauCountWithEntriesUpToSize
domain: Partition statistics
signature: SemistandardTableauCountWithEntriesUpToSize(partition)
summary: Semistandard tableaux of the shape with entries at most the size of the partition.
catalog:
  - system: findstat
    identity: St000705
    url: https://www.findstat.org/St000705
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SemistandardTableauCountWithEntriesUpToSize(partition)
    description: The number of semistandard tableaux of the shape with entries at most the size of the partition.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
