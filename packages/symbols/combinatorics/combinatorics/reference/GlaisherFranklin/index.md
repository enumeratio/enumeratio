---
name: GlaisherFranklin
domain: Combinatorial maps
signature: GlaisherFranklin(IntegerPartition)
summary: "The Glaisher-Franklin bijection: even part sizes halved become repeated parts, and repeated odd parts merge into their binary multiples."
laws:
  - bijection
  - inverse: InverseGlaisherFranklin
  - graded:
      from: IntegerPartitions
      to: IntegerPartitions
    on: integer_partition
catalog:
  - system: findstat
    identity: Mp00312
    url: https://www.findstat.org/Mp00312
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: GlaisherFranklin(IntegerPartition)
    description: "The Glaisher-Franklin bijection: even part sizes halved become repeated parts, and repeated odd parts merge into their binary multiples."
    library: enumeratio-combinatorics
    type: (integer_partition) -> integer_partition
---

- Takes a `IntegerPartition` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- FindStat's Mp00312. It sends the set of even part sizes, each halved, to the set of repeated part sizes.
