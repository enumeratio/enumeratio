---
name: FlagZerosToZeros
domain: Combinatorial maps
signature: FlagZerosToZeros(BinaryWord)
summary: The word with as many zeros as this one, prepended with its reverse complement, has occurrences of 10.
catalog:
  - system: findstat
    identity: Mp00269
    url: https://www.findstat.org/Mp00269
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - bijection
  - inverse: ZerosToFlagZeros
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: FlagZerosToZeros(BinaryWord)
    description: The word with as many zeros as this one, prepended with its reverse complement, has occurrences of 10.
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00269, the inverse of ZerosToFlagZeros.
