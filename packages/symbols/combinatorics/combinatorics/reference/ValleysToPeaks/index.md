---
name: ValleysToPeaks
domain: Combinatorial maps
signature: ValleysToPeaks(BinaryWord)
summary: Every valley 01 swapped for a peak 10, and a trailing 0 made a 1.
catalog:
  - system: findstat
    identity: Mp00234
    url: https://www.findstat.org/Mp00234
    on: BinaryWord
mapOn:
  - BinaryWord
laws:
  - graded:
      from: BinaryWords
      to: BinaryWords
    on: binary_word
signatures:
  - call: ValleysToPeaks(BinaryWord)
    description: Every valley 01 swapped for a peak 10, and a trailing 0 made a 1.
    library: enumeratio-combinatorics
    type: (binary_word) -> binary_word
---

- Takes a `BinaryWord` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00234. Lossy: 01 and 10 both give 10.
