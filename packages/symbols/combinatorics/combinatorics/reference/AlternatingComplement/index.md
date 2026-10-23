---
name: AlternatingComplement
domain: Combinatorial maps
signature: AlternatingComplement(BinaryWord)
summary: Every second letter swapped for the other, starting with the second.
catalog:
  - system: findstat
    identity: Mp00158
    url: https://www.findstat.org/Mp00158
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - involution
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: AlternatingComplement(BinaryWord)
    description: Every second letter swapped for the other, starting with the second.
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00158, "alternating inverse", an involution.
