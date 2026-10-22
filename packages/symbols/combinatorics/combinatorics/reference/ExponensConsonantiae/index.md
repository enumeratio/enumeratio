---
name: ExponensConsonantiae
domain: Partition statistics
signature: ExponensConsonantiae(partition)
summary: The least common multiple of the parts over their greatest common divisor.
signatures:
  - call: ExponensConsonantiae(partition)
    description: The least common multiple of the parts over their greatest common divisor.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
