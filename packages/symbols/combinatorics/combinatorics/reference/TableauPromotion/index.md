---
name: TableauPromotion
domain: Combinatorial maps
signature: TableauPromotion(StandardTableau)
summary: "Promotion: replace the largest entry by a hole, slide it to the corner at the origin, and add one to every entry."
catalog:
  - system: findstat
    identity: Mp00155
    url: https://www.findstat.org/Mp00155
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - inverse: InverseTableauPromotion
  - graded:
      from: StandardTableaux
      to: StandardTableaux
    on: standard_tableau
signatures:
  - call: TableauPromotion(StandardTableau)
    description: "Promotion: replace the largest entry by a hole, slide it to the corner at the origin, and add one to every entry."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> standard_tableau
---

- Takes a `StandardTableau` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00155, the inverse of InverseTableauPromotion. The hole is walked through the rows entry by entry, as jeu de taquin does.
