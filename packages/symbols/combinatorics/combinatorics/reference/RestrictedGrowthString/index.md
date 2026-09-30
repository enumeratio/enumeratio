---
name: RestrictedGrowthString
domain: Collections
signature: RestrictedGrowthString(list)
summary: "The singular-inhabitant constructor for a restricted growth string: a word w with w₁ = 0 and each letter at most one more than every letter before it."
references:
  - system: wikipedia
    identity: Partition of a set#Restricted growth functions
signatures:
  - call: RestrictedGrowthString(list)
    description: "The singular-inhabitant constructor for a restricted growth string: a word w with w₁ = 0 and each letter at most one more than every letter before it."
    library: enumeratio-combinatorics
    type: ((list<integer>) -> restricted_growth_string) & ((set_partition) -> restricted_growth_string)
seeAlso:
  - RestrictedGrowthStrings
  - SetPartition
laws:
  - inverse: SetPartition
  - orderIsomorphism:
      from: SetPartitions
      to: RestrictedGrowthStrings
---

- The same structure as a set partition, written as the block index of each position: $01022$ is
  $\{1,3\} \mid \{2\} \mid \{4,5\}$. The two carriers are joined by an order isomorphism
  (`RestrictedGrowthString(partition)`, `SetPartition(string)`), so every statistic and map defined on set
  partitions answers on restricted growth strings too.
