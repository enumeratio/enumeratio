---
name: ConjugateDistinctParts
domain: Partition statistics
signature: ConjugateDistinctParts(partition)
summary: Distinct part sizes of the conjugate.
statOn:
  - IntegerPartition
signatures:
  - call: ConjugateDistinctParts(partition)
    description: Distinct part sizes of the conjugate.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
