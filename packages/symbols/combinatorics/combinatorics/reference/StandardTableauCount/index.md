---
name: StandardTableauCount
domain: Partition statistics
signature: StandardTableauCount(partition)
summary: "The number of standard Young tableaux of the shape: the size factorial over the hook product."
catalog:
  - system: findstat
    identity: St000003
    url: https://www.findstat.org/St000003
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: StandardTableauCount(partition)
    description: "The number of standard Young tableaux of the shape: the size factorial over the hook product."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Defined by the hook-length formula; PlancherelCount is its square.
