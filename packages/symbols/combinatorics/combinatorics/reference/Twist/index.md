---
name: Twist
domain: Combinatorial maps
signature: Twist(BinaryWord)
summary: The first letter swapped for the other.
catalog:
  - system: findstat
    identity: Mp00200
    url: https://www.findstat.org/Mp00200
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
  - call: Twist(BinaryWord)
    description: The first letter swapped for the other.
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00200, an involution.
