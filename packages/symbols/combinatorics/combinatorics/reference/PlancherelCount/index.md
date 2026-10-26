---
name: PlancherelCount
domain: Partition statistics
signature: PlancherelCount(partition)
summary: "The square of the number of standard tableaux: the permutations whose Robinson-Schensted shape is this partition."
catalog:
  - system: findstat
    identity: St000284
    url: https://www.findstat.org/St000284
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PlancherelCount(partition)
    description: "The square of the number of standard tableaux: the permutations whose Robinson-Schensted shape is this partition."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
