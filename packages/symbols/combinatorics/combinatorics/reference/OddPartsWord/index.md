---
name: OddPartsWord
domain: Combinatorial maps
signature: OddPartsWord(IntegerPartition)
summary: The binary word marking which parts are odd, the parts taken largest first.
catalog:
  - system: findstat
    identity: Mp00317
    url: https://www.findstat.org/Mp00317
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: OddPartsWord(IntegerPartition)
    description: The binary word marking which parts are odd, the parts taken largest first.
    library: enumeratio-combinatorics
    type: (integer_partition) -> binary_word
---

- Takes a `IntegerPartition` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00317. Lossy: only the parts' parity is kept.
