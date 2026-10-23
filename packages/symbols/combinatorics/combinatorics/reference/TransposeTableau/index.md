---
name: TransposeTableau
domain: Combinatorial maps
signature: TransposeTableau(StandardTableau)
summary: "The conjugate tableau: rows and columns exchanged."
catalog:
  - system: findstat
    identity: Mp00084
    url: https://www.findstat.org/Mp00084
    on: StandardTableau
mapOn:
  - StandardTableau
signatures:
  - call: TransposeTableau(StandardTableau)
    description: "The conjugate tableau: rows and columns exchanged."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> standard_tableau
laws:
  - involution
  - graded:
      from: StandardTableaux
      to: StandardTableaux
    on: standard_tableau
---

- Takes a `StandardTableau` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Its shape is the conjugate of the original's, so it is TransposePartition on shapes.
