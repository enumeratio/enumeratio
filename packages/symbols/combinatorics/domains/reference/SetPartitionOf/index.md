---
name: SetPartitionOf
domain: Combinatorial maps
signature: SetPartitionOf(RestrictedGrowthString)
summary: "The set partition a restricted growth string labels: block j holds the positions labelled j."
signatures:
  - call: SetPartitionOf(RestrictedGrowthString)
    description: "The set partition a restricted growth string labels: block j holds the positions labelled j."
    library: enumeratio-domains
    type: (restricted_growth_string) -> set_partition
---

- Takes a `RestrictedGrowthString` and returns a `SetPartition` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- The inverse of RestrictedGrowthStringOf, and order-preserving in the same way.
