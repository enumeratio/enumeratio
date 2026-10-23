---
name: ReadingWord
domain: Combinatorial maps
signature: ReadingWord(StandardTableau)
summary: The rows read left to right, from the bottom row up, as a permutation.
catalog:
  - system: findstat
    identity: Mp00081
    url: https://www.findstat.org/Mp00081
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - graded:
      from: StandardTableaux
      to: Permutations
    on: standard_tableau
signatures:
  - call: ReadingWord(StandardTableau)
    description: The rows read left to right, from the bottom row up, as a permutation.
    library: enumeratio-combinatorics
    type: (standard_tableau) -> permutation
---

- Takes a `StandardTableau` and returns a `Permutation` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00081, the row reading word. Injective; RskInsertion of it is the tableau back again.
