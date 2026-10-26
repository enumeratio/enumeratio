---
name: SemistandardTableauCountWithEntriesUpToTwo
domain: Partition statistics
signature: SemistandardTableauCountWithEntriesUpToTwo(partition)
summary: "Semistandard tableaux of the shape with entries at most 2: the product of 2 + j - i over the cells, over the hook product."
catalog:
  - system: findstat
    identity: St000714
    url: https://www.findstat.org/St000714
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SemistandardTableauCountWithEntriesUpToTwo(partition)
    description: "The number of semistandard tableaux of the shape with entries at most 2: the product of 2 + j - i over the cells, over the hook product."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
