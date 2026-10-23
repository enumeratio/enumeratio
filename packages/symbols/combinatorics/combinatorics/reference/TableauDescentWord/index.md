---
name: TableauDescentWord
domain: Combinatorial maps
signature: TableauDescentWord(StandardTableau)
summary: Letter i is 1 when entry i + 1 sits in a lower row than entry i.
catalog:
  - system: findstat
    identity: Mp00134
    url: https://www.findstat.org/Mp00134
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - surjection
  - graded:
      from: StandardTableaux
      to: BinaryWords
      sizeOffset: -1
    on: standard_tableau
signatures:
  - call: TableauDescentWord(StandardTableau)
    description: Letter i is 1 when entry i + 1 sits in a lower row than entry i.
    library: enumeratio-combinatorics
    type: (standard_tableau) -> binary_word
---

- Takes a `StandardTableau` and returns a `BinaryWord` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00134. The word is one letter shorter than the tableau has entries.
