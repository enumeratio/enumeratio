---
name: PathRowmotion
domain: Combinatorial maps
signature: PathRowmotion(BinaryWord)
summary: "Rowmotion of the word as a lattice path: the path whose peaks are the original's valleys with an up step appended."
catalog:
  - system: findstat
    identity: Mp00280
    url: https://www.findstat.org/Mp00280
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - bijection
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: PathRowmotion(BinaryWord)
    description: "Rowmotion of the word as a lattice path: the path whose peaks are the original's valleys with an up step appended."
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00280, a bijection. Not Rowmotion: that reads the word as an order ideal.
