---
name: TransposePartition
domain: Combinatorial maps
signature: TransposePartition(IntegerPartition)
summary: "The conjugate partition: column i of the Ferrers diagram becomes row i."
catalog:
  - system: findstat
    identity: Mp00044
    url: https://www.findstat.org/Mp00044
    on: IntegerPartition
mapOn:
  - IntegerPartition
signatures:
  - call: TransposePartition(IntegerPartition)
    description: "The conjugate partition: column i of the Ferrers diagram becomes row i."
    library: enumeratio-combinatorics
    type: (integer_partition) -> integer_partition
laws:
  - involution
---

- Takes a `IntegerPartition` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- Entry i of the result counts the parts that are at least i, so it is its own inverse and swaps the number of parts with the largest part. Combinatorica's TransposePartition; FindStat's Mp00044, "conjugate". Wolfram's Conjugate is the complex conjugate, not this map.
