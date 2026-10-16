---
name: DistinctSubsetSums
domain: Partition statistics
signature: DistinctSubsetSums(partition)
summary: Distinct sums of non-empty sub-multisets of the parts.
catalog:
  - system: findstat
    identity: St000548
    url: https://www.findstat.org/St000548
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: DistinctSubsetSums(partition)
    description: Distinct sums of non-empty sub-multisets of the parts.
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
- Follows FindStat's Sage code and its data, not its title: the "partial sums" it counts are the sums of arbitrary sub-multisets of the parts (the code runs over all subsets), not of the running prefixes.
