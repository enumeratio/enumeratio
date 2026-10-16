---
name: BerkovichGarvanRank
domain: Partition statistics
signature: BerkovichGarvanRank(partition)
summary: The sum of a checkerboard filling of the diagram, +1 on cells whose coordinates sum to an even number and -1 on the others.
catalog:
  - system: findstat
    identity: St001383
    url: https://www.findstat.org/St001383
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: BerkovichGarvanRank(partition)
    description: The sum of a checkerboard filling of the diagram, +1 on cells whose coordinates sum to an even number and -1 on the others.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- A row of even length cancels and one of odd length leaves a single cell, counted + in the first row, - in the second, and so on.
