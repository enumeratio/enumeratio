---
name: CyclePartition
domain: Combinatorial maps
signature: CyclePartition(Permutation)
summary: The orbits, as a set partition of the positions.
catalog:
  - system: findstat
    identity: Mp00151
    url: https://www.findstat.org/Mp00151
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: CyclePartition(Permutation)
    description: The orbits, as a set partition of the positions.
    library: enumeratio-combinatorics
    type: (permutation) -> set_partition
laws:
  - surjection
  - graded:
      from: Permutations
      to: SetPartitions
---

- Takes a `Permutation` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Removed once for giving every position the same label. The cause was the laziness rule in tableau.ts — folding over a list taken out of the accumulator instead of indexing a range. Written by index it is right first time.
