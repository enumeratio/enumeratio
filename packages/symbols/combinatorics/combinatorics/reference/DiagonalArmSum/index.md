---
name: DiagonalArmSum
domain: Partition statistics
signature: DiagonalArmSum(partition)
summary: The sum of the arms of the cells on the main diagonal.
catalog:
  - system: findstat
    identity: St000319
    url: https://www.findstat.org/St000319
    on: IntegerPartition
  - system: findstat
    identity: St000320
    url: https://www.findstat.org/St000320
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: DiagonalArmSum(partition)
    description: The sum of the arms of the cells on the main diagonal.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's spin (St000319) counts the crossings of the border strips and its dinv adjustment (St000320) sums over their starting columns; each strip contributes its first part less 1, which is the arm of one diagonal cell, and the two agree on every row.
