---
name: RowCellPairs
domain: Partition statistics
signature: RowCellPairs(partition)
summary: "Pairs of cells in the same row: the sum over parts of the binomial coefficient of the part and 2."
catalog:
  - system: findstat
    identity: St000566
    url: https://www.findstat.org/St000566
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: RowCellPairs(partition)
    description: "Pairs of cells in the same row: the sum over parts of the binomial coefficient of the part and 2."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
