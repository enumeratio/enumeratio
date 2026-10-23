---
name: ZerosToFlagZeros
domain: Combinatorial maps
signature: ZerosToFlagZeros(BinaryWord)
summary: The word whose reverse complement, prepended, has as many occurrences of 10 as this has zeros.
catalog:
  - system: findstat
    identity: Mp00268
    url: https://www.findstat.org/Mp00268
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - bijection
  - inverse: FlagZerosToZeros
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: ZerosToFlagZeros(BinaryWord)
    description: The word whose reverse complement, prepended, has as many occurrences of 10 as this has zeros.
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00268, the inverse of FlagZerosToZeros.
