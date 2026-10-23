---
name: Reverse
domain: Combinatorial maps
signature: Reverse(Permutation)
summary: The word read backwards.
names:
  wolframIdentity: true
catalog:
  - system: findstat
    identity: Mp00038
    url: https://www.findstat.org/Mp00038
    on: Composition
  - system: findstat
    identity: Mp00064
    url: https://www.findstat.org/Mp00064
    on: Permutation
  - system: findstat
    identity: Mp00104
    url: https://www.findstat.org/Mp00104
    on: BinaryWord
mapOn:
  - BinaryWord
  - Composition
  - Permutation
  - SetPartition
signatures:
  - call: Reverse(Permutation)
    description: The word read backwards.
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((composition) -> composition) & ((permutation) -> permutation)
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
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Also takes a `Composition`, returning a `Composition`: The parts read backwards.
- Also takes a `BinaryWord`, returning a `BinaryWord`: The word read backwards.
