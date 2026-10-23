---
name: CodeComposition
domain: Combinatorial maps
signature: CodeComposition(BinaryWord)
summary: "The composition whose code is the word with a 1 put in front: each 1 opens a part, of 1 plus the zeros after it."
catalog:
  - system: findstat
    identity: Mp00178
    url: https://www.findstat.org/Mp00178
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - graded:
      from: BinaryWords
      to: IntegerCompositions
      sizeOffset: 1
    on: binary_word
signatures:
  - call: CodeComposition(BinaryWord)
    description: "The composition whose code is the word with a 1 put in front: each 1 opens a part, of 1 plus the zeros after it."
    library: enumeratio-combinatorics
    type: (binary_word) -> composition
---

- Takes a `BinaryWord` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00178, Sage's from_code. An injection one size up (the empty composition has no preimage); the inverse of CodeWord on the words that start with 1. Not Composition, whose word marks the cuts.
