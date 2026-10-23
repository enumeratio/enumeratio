---
name: GrayPrevious
domain: Combinatorial maps
signature: GrayPrevious(BinaryWord)
summary: "The previous word in the Gray code: flip the first letter when the ones are odd in number, else the letter after the first one."
catalog:
  - system: findstat
    identity: Mp00273
    url: https://www.findstat.org/Mp00273
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - inverse: GrayNext
signatures:
  - call: GrayPrevious(BinaryWord)
    description: "The previous word in the Gray code: flip the first letter when the ones are odd in number, else the letter after the first one."
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00273, the inverse of GrayNext. The zero word gets its last letter flipped.
