---
name: FoataInversionsToMajor
domain: Combinatorial maps
signature: FoataInversionsToMajor(Permutation)
summary: "The inverse of Foata's major-to-inversions bijection: peel off the last letter, rotate the blocks of the rest back."
catalog:
  - system: findstat
    identity: Mp00175
    url: https://www.findstat.org/Mp00175
    on: Permutation
  - system: findstat
    identity: Mp00315
    url: https://www.findstat.org/Mp00315
    on: Composition
  - system: findstat
    identity: Mp00316
    url: https://www.findstat.org/Mp00316
    on: BinaryWord
mapOn:
  - BinaryWord
  - Composition
  - Permutation
laws:
  - bijection
  - inverse: FoataMajorToInversions
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
signatures:
  - call: FoataInversionsToMajor(Permutation)
    description: "The inverse of Foata's major-to-inversions bijection: peel off the last letter, rotate the blocks of the rest back."
    library: enumeratio-combinatorics
    type: ((binary_word) -> binary_word) & ((composition) -> composition) & ((permutation) -> permutation)
---

- Takes a `Permutation` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00175, Sage's foata_bijection_inverse. It sends the number of inversions to the major index.
- Also takes a `Composition`, returning a `Composition`: The inverse of Foata's bijection on compositions: peel off the last part, rotate the blocks of the rest back.
- FindStat's Mp00315.
- Also takes a `BinaryWord`, returning a `BinaryWord`: The inverse of Foata's bijection on words: peel off the last letter, rotate the blocks of the rest back.
- FindStat's Mp00316.
