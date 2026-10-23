---
name: OccurrencesOf1Over23Openers1Closers3Arc23
domain: Set partition statistics
signature: OccurrencesOf1Over23Openers1Closers3Arc23(partition)
summary: Occurrences of the pattern 1/23 with 1 the least element of its block, 3 the greatest element of its block and 2 and 3 consecutive in one block.
signatures:
  - call: OccurrencesOf1Over23Openers1Closers3Arc23(partition)
    description: Occurrences of the pattern 1/23 with 1 the least element of its block, 3 the greatest element of its block and 2 and 3 consecutive in one block.
    library: enumeratio-combinatorics
    type: (set_partition) -> number
catalog:
  - system: findstat
    identity: St000614
    url: https://www.findstat.org/St000614
    on: SetPartition
statOn:
  - SetPartition
---

- Defined over `SetPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `SetPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
