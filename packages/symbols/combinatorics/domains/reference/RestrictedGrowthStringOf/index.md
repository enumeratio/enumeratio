---
name: RestrictedGrowthStringOf
domain: Combinatorial maps
signature: RestrictedGrowthStringOf(SetPartition)
summary: "A set partition's restricted growth string: each position labelled with its block's index, from 0."
signatures:
  - call: RestrictedGrowthStringOf(SetPartition)
    description: "A set partition's restricted growth string: each position labelled with its block's index, from 0."
    library: enumeratio-domains
    type: (set_partition) -> restricted_growth_string
---

- Takes a `SetPartition` and returns a `RestrictedGrowthString` — a typed map, so a wrong carrier is a type error rather than a wrong answer.
- An order isomorphism: the k-th set partition of n, in the order SetPartitions lists them, goes to the k-th restricted growth string of length n. So everything defined on one carrier is available on the other through it.
