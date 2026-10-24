---
name: InverseTableauPromotion
domain: Combinatorial maps
signature: InverseTableauPromotion(StandardTableau)
summary: "Inverse promotion: replace the entry 1 by n + 1, slide it out to the rim, and subtract one from every entry."
catalog:
  - system: findstat
    identity: Mp00153
    url: https://www.findstat.org/Mp00153
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - inverse: TableauPromotion
  - graded:
      from: StandardTableaux
      to: StandardTableaux
    on: standard_tableau
signatures:
  - call: InverseTableauPromotion(StandardTableau)
    description: "Inverse promotion: replace the entry 1 by n + 1, slide it out to the rim, and subtract one from every entry."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> standard_tableau
---

- Takes a `StandardTableau` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00153, the inverse of TableauPromotion. The hole is walked through the rows entry by entry, as jeu de taquin does.
