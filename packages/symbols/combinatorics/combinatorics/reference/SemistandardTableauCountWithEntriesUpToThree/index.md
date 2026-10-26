---
name: SemistandardTableauCountWithEntriesUpToThree
domain: Partition statistics
signature: SemistandardTableauCountWithEntriesUpToThree(partition)
summary: Semistandard tableaux of the shape with entries at most 3.
catalog:
  - system: findstat
    identity: St000715
    url: https://www.findstat.org/St000715
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SemistandardTableauCountWithEntriesUpToThree(partition)
    description: The number of semistandard tableaux of the shape with entries at most 3.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
