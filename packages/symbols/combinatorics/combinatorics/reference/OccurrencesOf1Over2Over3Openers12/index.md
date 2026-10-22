---
name: OccurrencesOf1Over2Over3Openers12
domain: Set partition statistics
signature: OccurrencesOf1Over2Over3Openers12(partition)
summary: Occurrences of the pattern 1/2/3 with 1 and 2 the least elements of their blocks.
signatures:
  - call: OccurrencesOf1Over2Over3Openers12(partition)
    description: Occurrences of the pattern 1/2/3 with 1 and 2 the least elements of their blocks.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
