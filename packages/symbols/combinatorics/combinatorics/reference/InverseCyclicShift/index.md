---
name: InverseCyclicShift
domain: Combinatorial maps
signature: InverseCyclicShift(Permutation)
summary: Rotate the word one place to the right.
catalog:
  - system: findstat
    identity: Mp00136
    url: https://www.findstat.org/Mp00136
    on: BinaryWord
  - system: findstat
    identity: Mp00172
    url: https://www.findstat.org/Mp00172
    on: Composition
mapOn:
  - BinaryWord
  - Composition
  - Permutation
signatures:
  - call: InverseCyclicShift(Permutation)
    description: Rotate the word one place to the right.
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((composition) -> composition)
laws:
  - inverse: CyclicShift
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
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Also takes a `Composition`, returning a `Composition`: Rotate the parts one place to the right: the last part moves to the front.
- Also takes a `BinaryWord`, returning a `BinaryWord`: Rotate the word one place to the right: the last letter moves to the front.
