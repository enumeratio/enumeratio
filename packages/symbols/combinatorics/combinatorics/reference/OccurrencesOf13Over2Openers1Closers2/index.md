---
name: OccurrencesOf13Over2Openers1Closers2
domain: Set partition statistics
signature: OccurrencesOf13Over2Openers1Closers2(partition)
summary: Occurrences of the pattern 13/2 with 1 the least element of its block and 2 the greatest element of its block.
signatures:
  - call: OccurrencesOf13Over2Openers1Closers2(partition)
    description: Occurrences of the pattern 13/2 with 1 the least element of its block and 2 the greatest element of its block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
catalog:
  - system: findstat
    identity: St000581
    url: https://www.findstat.org/St000581
    on: SetPartition
statOn:
  - SetPartition
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
