---
name: SymplecticDimensionRankThree
domain: Partition statistics
signature: SymplecticDimensionRankThree(partition)
summary: The dimension of the irreducible representation of Sp(6) with this highest weight; 0 if the partition has more than 3 parts.
catalog:
  - system: findstat
    identity: St000716
    url: https://www.findstat.org/St000716
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: SymplecticDimensionRankThree(partition)
    description: The dimension of the irreducible representation of Sp(6) with this highest weight; 0 if the partition has more than 3 parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
