---
name: RunComposition
domain: Combinatorial maps
signature: RunComposition(BinaryWord)
summary: The lengths of the maximal runs of equal letters, left to right.
catalog:
  - system: findstat
    identity: Mp00097
    url: https://www.findstat.org/Mp00097
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - surjection
  - graded:
      from: BinaryWords
      to: IntegerCompositions
    on: binary_word
signatures:
  - call: RunComposition(BinaryWord)
    description: The lengths of the maximal runs of equal letters, left to right.
    library: enumeratio-combinatorics
    type: (binary_word) -> composition
---

- Takes a `BinaryWord` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00097, the delta morphism. Lossy: it forgets the first letter, so each composition has two words.
