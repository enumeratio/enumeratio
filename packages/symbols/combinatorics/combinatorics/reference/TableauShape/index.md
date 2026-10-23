---
name: TableauShape
domain: Combinatorial maps
signature: TableauShape(StandardTableau)
summary: "The shape of a standard tableau: its row lengths."
catalog:
  - system: findstat
    identity: Mp00083
    url: https://www.findstat.org/Mp00083
    on: StandardTableau
mapOn:
  - StandardTableau
laws:
  - surjection
  - graded:
      from: StandardTableaux
      to: IntegerPartitions
    on: standard_tableau
signatures:
  - call: TableauShape(StandardTableau)
    description: "The shape of a standard tableau: its row lengths."
    library: enumeratio-combinatorics
    type: (standard_tableau) -> integer_partition
---

- Takes a `StandardTableau` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Lossy: the entries are forgotten, so it is not a constructor overload.
