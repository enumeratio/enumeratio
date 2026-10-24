---
name: ValleyComposition
domain: Combinatorial maps
signature: ValleyComposition(StandardTableau)
summary: "The composition cut at the valleys: entries i that are ascents after a descent."
catalog:
  - system: findstat
    identity: Mp00295
    url: https://www.findstat.org/Mp00295
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - graded:
      from: StandardTableaux
      to: IntegerCompositions
    on: standard_tableau
signatures:
  - call: ValleyComposition(StandardTableau)
    description: "The composition cut at the valleys: entries i that are ascents after a descent."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> composition
---

- Takes a `StandardTableau` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00295.
