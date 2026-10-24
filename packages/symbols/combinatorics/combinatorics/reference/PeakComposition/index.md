---
name: PeakComposition
domain: Combinatorial maps
signature: PeakComposition(StandardTableau)
summary: "The composition cut at the peaks: entries i that are descents after an ascent."
catalog:
  - system: findstat
    identity: Mp00294
    url: https://www.findstat.org/Mp00294
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - graded:
      from: StandardTableaux
      to: IntegerCompositions
    on: standard_tableau
signatures:
  - call: PeakComposition(StandardTableau)
    description: "The composition cut at the peaks: entries i that are descents after an ascent."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> composition
---

- Takes a `StandardTableau` and returns a `Composition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00294. An entry is a descent when the next one sits in a lower row.
