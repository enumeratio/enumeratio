---
name: RskShape
domain: Combinatorial maps
signature: RskShape(Permutation)
summary: "The common shape of the RSK tableaux: the row lengths, as a partition of n."
references:
  - system: wikipedia
    identity: Robinson–Schensted correspondence
catalog:
  - system: findstat
    identity: Mp00060
    url: https://www.findstat.org/Mp00060
    on: Permutation
mapOn:
  - Permutation
signatures:
  - call: RskShape(Permutation)
    description: "The common shape of the RSK tableaux: the row lengths, as a partition of n."
    library: enumeratio-combinatorics
    type: (permutation) -> integer_partition
laws:
  - surjection
  - graded:
      from: Permutations
      to: IntegerPartitions
---

- Takes a `Permutation` and returns a `IntegerPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- By Schensted, its first part is the longest increasing subsequence and its first COLUMN is the longest decreasing one — two statistics readable off this map.
