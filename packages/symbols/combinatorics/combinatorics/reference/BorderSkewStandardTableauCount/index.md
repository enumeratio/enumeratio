---
name: BorderSkewStandardTableauCount
domain: Partition statistics
signature: BorderSkewStandardTableauCount(partition)
summary: "Standard tableaux of the skew shape that adds a cell to every column of the diagram: the size factorial over the factorials of the cells added to each row (the size less the largest part, then the gaps between consecutive parts)."
catalog:
  - system: findstat
    identity: St001387
    url: https://www.findstat.org/St001387
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: BorderSkewStandardTableauCount(partition)
    description: "The standard tableaux of the skew shape that adds one cell to every column of the diagram, and one in each new column to the right: the size factorial over the factorials of the cells added to each row, which are the first row's size less the largest part, then the differences between consecutive parts."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
