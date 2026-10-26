---
name: PairsOfDistinctParts
domain: Partition statistics
signature: PairsOfDistinctParts(partition)
summary: "Pairs of parts that differ in size: the degree of the polynomial counting semistandard tableaux of the stretched shape."
catalog:
  - system: findstat
    identity: St000175
    url: https://www.findstat.org/St000175
    on: IntegerPartition
statOn:
  - IntegerPartition
signatures:
  - call: PairsOfDistinctParts(partition)
    description: "Pairs of parts that differ: the degree of the polynomial that counts semistandard tableaux of the stretched shape."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
