---
name: ShorterSideRookPlacementCount
domain: Partition statistics
signature: ShorterSideRookPlacementCount(partition)
summary: The ways to place as many non-attacking rooks as the shorter side of the Ferrers board's bounding rectangle has cells, 0 when they do not fit.
catalog:
  - system: findstat
    identity: St000531
    url: https://www.findstat.org/St000531
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: ShorterSideRookPlacementCount(partition)
    description: The ways to place as many non-attacking rooks as the shorter side of the Ferrers board's bounding rectangle has cells, 0 when they do not fit.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- FindStat's title calls this the leading coefficient of the rook polynomial, but its code takes the entry for the shorter side, which is 0 when no placement fills it; the name follows the code.
