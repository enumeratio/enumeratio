---
name: SecondAlladiWeight
domain: Partition statistics
signature: SecondAlladiWeight(partition)
summary: Half the last part (rounded up if odd), times the product over consecutive parts of half the gap less 1 for each even one of the two.
signatures:
  - call: SecondAlladiWeight(partition)
    description: Half the last part (rounded up if odd), times the product over consecutive parts of half the gap less 1 for each even one of the two.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000478
    url: https://www.findstat.org/St000478
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Alladi's second weight: for each part, delta is 1 if it is even and 0 if odd; the factor for the last part is (last + 1 - delta)/2 and for each consecutive pair (gap - delta - delta')/2.
