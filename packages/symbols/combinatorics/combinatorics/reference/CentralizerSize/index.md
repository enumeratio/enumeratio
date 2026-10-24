---
name: CentralizerSize
domain: Partition statistics
signature: CentralizerSize(partition)
summary: "The size of the centralizer of a permutation with these cycle lengths: the product of the parts times the product of the factorials of the multiplicities."
signatures:
  - call: CentralizerSize(partition)
    description: "The size of the centralizer of a permutation with these cycle lengths: the product of the parts times the product of the factorials of the multiplicities."
    library: enumeratio-combinatorics
    type: (integer_partition) -> number
catalog:
  - system: findstat
    identity: St000184
    url: https://www.findstat.org/St000184
    on: IntegerPartition
statOn:
  - IntegerPartition
---

- Defined over `IntegerPartition` as an expression in `_x`, evaluated by compute-engine — the definition IS the implementation.
- Takes a `IntegerPartition` and nothing else — it reads values against their positions, or walks the orbits, so it needs the bijection. Applying it to a bare list is a type error, not a wrong answer.
