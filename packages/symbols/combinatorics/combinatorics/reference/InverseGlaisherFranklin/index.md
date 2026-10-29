---
name: InverseGlaisherFranklin
domain: Combinatorial maps
signature: InverseGlaisherFranklin(IntegerPartition)
summary: "The inverse of GlaisherFranklin: repeated parts merge into doubled parts, and a leftover part splits into copies of its odd part."
laws:
  - bijection
  - inverse: GlaisherFranklin
  - graded:
      from: IntegerPartitions
      to: IntegerPartitions
    on: integer_partition
catalog:
  - system: findstat
    identity: Mp00313
    url: https://www.findstat.org/Mp00313
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: InverseGlaisherFranklin(IntegerPartition)
    description: "The inverse of GlaisherFranklin: repeated parts merge into doubled parts, and a leftover part splits into copies of its odd part."
    library: enumeratio-combinatorics
    type: (integer_partition) -> integer_partition
---

- Takes a `IntegerPartition` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00313. It sends the number of distinct repeated part sizes to the number of distinct even part sizes.
