---
name: CodeWord
domain: Combinatorial maps
signature: CodeWord(Composition)
summary: The word that writes each part i as a one followed by i - 1 zeros.
catalog:
  - system: findstat
    identity: Mp00094
    url: https://www.findstat.org/Mp00094
    on: Composition
mapOn:
  - Composition
laws:
  - graded:
      from: IntegerCompositions
      to: BinaryWords
    on: composition
signatures:
  - call: CodeWord(Composition)
    description: The word that writes each part i as a one followed by i - 1 zeros.
    library: enumeratio-combinatorics
    type: (composition) -> binary_word
---

- Takes a `Composition` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00094, Sage's to_code. An injection; its image is the words that start with a 1. Not CutWord, which marks the cuts and is one letter shorter than the size.
