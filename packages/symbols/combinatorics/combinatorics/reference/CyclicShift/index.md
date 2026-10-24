---
name: CyclicShift
domain: Combinatorial maps
signature: CyclicShift(Permutation)
summary: Rotate the word one place to the left.
catalog:
  - system: findstat
    identity: Mp00135
    url: https://www.findstat.org/Mp00135
    on: BinaryWord
  - system: findstat
    identity: Mp00173
    url: https://www.findstat.org/Mp00173
    on: Composition
  - system: findstat
    identity: Mp00279
    url: https://www.findstat.org/Mp00279
    on: Permutation
  - system: findstat
    identity: Mp00292
    url: https://www.findstat.org/Mp00292
    on: SetComposition
mapOn:
  - BinaryWord
  - Composition
  - Permutation
  - SetComposition
signatures:
  - call: CyclicShift(Permutation)
    description: Rotate the word one place to the left.
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((composition) -> composition) & ((set_composition) -> set_composition)
laws:
  - inverse: InverseCyclicShift
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
      from: SetCompositions
      to: SetCompositions
    on: set_composition
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Also takes a `SetComposition`, returning a `SetComposition`: The first block moved to the end.
- FindStat's Mp00292.
- Also takes a `Composition`, returning a `Composition`: Rotate the parts one place to the left: the first part moves to the end.
- Also takes a `BinaryWord`, returning a `BinaryWord`: Rotate the word one place to the left: the first letter moves to the end.
