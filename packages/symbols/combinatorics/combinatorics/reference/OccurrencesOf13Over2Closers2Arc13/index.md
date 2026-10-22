---
name: OccurrencesOf13Over2Closers2Arc13
domain: Set partition statistics
signature: OccurrencesOf13Over2Closers2Arc13(partition)
summary: Occurrences of the pattern 13/2 with 2 the greatest element of its block and 1 and 3 consecutive in one block.
signatures:
  - call: OccurrencesOf13Over2Closers2Arc13(partition)
    description: Occurrences of the pattern 13/2 with 2 the greatest element of its block and 1 and 3 consecutive in one block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
