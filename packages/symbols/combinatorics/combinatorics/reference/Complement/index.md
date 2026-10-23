---
name: Complement
domain: Combinatorial maps
signature: Complement(Permutation)
summary: Each entry replaced by n + 1 minus itself.
catalog:
  - system: findstat
    identity: Mp00039
    url: https://www.findstat.org/Mp00039
    on: Composition
  - system: findstat
    identity: Mp00069
    url: https://www.findstat.org/Mp00069
    on: Permutation
  - system: findstat
    identity: Mp00105
    url: https://www.findstat.org/Mp00105
    on: BinaryWord
  - system: findstat
    identity: Mp00112
    url: https://www.findstat.org/Mp00112
    on: SetPartition
  - system: findstat
    identity: Mp00289
    url: https://www.findstat.org/Mp00289
    on: SetComposition
mapOn:
  - BinaryWord
  - Composition
  - Permutation
  - SetComposition
  - SetPartition
signatures:
  - call: Complement(Permutation)
    description: Each entry replaced by n + 1 minus itself.
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((composition) -> composition) & ((permutation) -> permutation) & ((set_composition) -> set_composition) & ((set_partition) -> set_partition)
    overrides: compute-engine
laws:
  - involution
  - graded:
      from: Permutations
      to: Permutations
    on: permutation
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
  - graded:
      from: IntegerCompositions
      to: IntegerCompositions
    on: composition
  - graded:
      from: SetPartitions
      to: SetPartitions
    on: set_partition
  - graded:
      from: SetCompositions
      to: SetCompositions
    on: set_composition
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Also takes a `SetPartition`, returning a `SetPartition`: Each element i replaced by n + 1 - i: the set partition seen from the other end.
- Also takes a `SetComposition`, returning a `SetComposition`: Each element i replaced by n + 1 - i, the blocks staying in their order.
- FindStat's Mp00289.
- Also takes a `Composition`, returning a `Composition`: The composition cut exactly where this one is not: its cut set complemented.
- Reverse then complement is TransposeComposition, and reversing commutes with complementing.
- Also takes a `BinaryWord`, returning a `BinaryWord`: Each letter swapped for the other: 0 for 1 and 1 for 0.
