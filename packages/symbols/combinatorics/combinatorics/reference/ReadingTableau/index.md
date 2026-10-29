---
name: ReadingTableau
domain: Combinatorial maps
signature: ReadingTableau(IntegerPartition)
summary: The recording tableau of the row reading word of the shape filled row by row.
seeAlso:
  - RskRecording
  - ReadingWord
  - InitialTableau
laws:
  - graded:
      from: IntegerPartitions
      to: StandardTableaux
    on: integer_partition
catalog:
  - system: findstat
    identity: Mp00045
    url: https://www.findstat.org/Mp00045
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: ReadingTableau(IntegerPartition)
    description: The recording tableau of the row reading word of the shape filled row by row.
    library: enumeratio-combinatorics
    type: (integer_partition) -> standard_tableau
---

- Takes a `IntegerPartition` and returns a `StandardTableau` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Defined as a COMPOSITION, applied right to left: [[RskRecording]] after [[ReadingWord]] after [[InitialTableau]]. Each step goes through its own declared head, so every intermediate value is a properly constructed carrier.
- FindStat's Mp00045. Injective. The RSK insertion tableau of that word is the filled shape again, so this is the other half of its pair.
