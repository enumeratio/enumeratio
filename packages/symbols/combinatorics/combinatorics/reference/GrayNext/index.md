---
name: GrayNext
domain: Combinatorial maps
signature: GrayNext(BinaryWord)
summary: "The next word in the Gray code: flip the first letter when the ones are even in number, else the letter after the first one."
catalog:
  - system: findstat
    identity: Mp00272
    url: https://www.findstat.org/Mp00272
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - bijection
  - inverse: GrayPrevious
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: GrayNext(BinaryWord)
    description: "The next word in the Gray code: flip the first letter when the ones are even in number, else the letter after the first one."
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00272, a bijection. The last word of the code, with its only one last, goes to the zero word.
