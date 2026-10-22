---
name: EdgeOrbitCount
domain: Partition statistics
signature: EdgeOrbitCount(partition)
summary: "Orbits of the complete graph's edges under a permutation with these cycle lengths: the sum of half the parts rounded down, plus the sum of gcd(part, part) over pairs."
signatures:
  - call: EdgeOrbitCount(partition)
    description: "Orbits of the complete graph's edges under a permutation with these cycle lengths: the sum of half the parts rounded down, plus the sum of gcd(part, part) over pairs."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
