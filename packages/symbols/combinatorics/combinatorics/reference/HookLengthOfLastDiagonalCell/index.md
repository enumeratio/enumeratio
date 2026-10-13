---
name: HookLengthOfLastDiagonalCell
domain: Partition statistics
signature: HookLengthOfLastDiagonalCell(partition)
summary: "The hook length of the last cell on the main diagonal: that of cell (d,d) for Durfee side d."
catalog:
  - system: findstat
    identity: St000460
    url: https://www.findstat.org/St000460
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: HookLengthOfLastDiagonalCell(partition)
    description: "The hook length of the last cell on the main diagonal: that of cell (d,d) for Durfee side d."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
