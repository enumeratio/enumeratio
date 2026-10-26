---
name: SymplecticDimensionRankTwo
domain: Partition statistics
signature: SymplecticDimensionRankTwo(partition)
summary: The dimension of the irreducible representation of Sp(4) with this highest weight; 0 if the partition has more than 2 parts.
catalog:
  - system: findstat
    identity: St000713
    url: https://www.findstat.org/St000713
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SymplecticDimensionRankTwo(partition)
    description: The dimension of the irreducible representation of Sp(4) with this highest weight; 0 if the partition has more than 2 parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
