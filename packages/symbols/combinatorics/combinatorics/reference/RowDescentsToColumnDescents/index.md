---
name: RowDescentsToColumnDescents
domain: Combinatorial maps
signature: RowDescentsToColumnDescents(StandardTableau)
summary: A standard tableau of the same shape whose column descents are the original's row descents.
catalog:
  - system: findstat
    identity: Mp00226
    url: https://www.findstat.org/Mp00226
    on: StandardTableau
mapOn:
  - StandardTableau
signatures:
  - call: RowDescentsToColumnDescents(StandardTableau)
    description: A standard tableau of the same shape whose column descents are the original's row descents.
    library: enumeratio-combinatorics
    type: (standard_tableau) -> standard_tableau
---

- Takes a `StandardTableau` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00226, a bijection. From the natural labelling of the shape, d and d + 1 are exchanged at each column descent d, the tableau following by the same exchange unless that keeps its descents.
