---
name: Evacuation
domain: Combinatorial maps
signature: Evacuation(StandardTableau)
summary: "Schützenberger's evacuation (involution): remove the entry 1, slide the rest in, and give the cell that empties the largest label, until nothing is left."
catalog:
  - system: findstat
    identity: Mp00085
    url: https://www.findstat.org/Mp00085
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - involution
  - graded:
      from: StandardTableaux
      to: StandardTableaux
    on: standard_tableau
signatures:
  - call: Evacuation(StandardTableau)
    description: "Schützenberger's evacuation (involution): remove the entry 1, slide the rest in, and give the cell that empties the largest label, until nothing is left."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> standard_tableau
---

- Takes a `StandardTableau` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00085. Computed as the insertion tableau of the reading word reversed and complemented; the same shape, and an involution.
